/**
 * Backend Enforcement Tests
 *
 * Error handling, cross-domain isolation, anti-pattern detection,
 * and rate limit enforcement.
 */
import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  CONVEX,
  walkFiles,
  read,
  rel,
  getDomains,
  RATE_LIMITED_MUTATION_WRAPPERS,
} from "../helpers";

// =============================================================================
// 1. ERROR HANDLING
// =============================================================================

describe("1. Error Handling", () => {
  const backendFiles = [
    ...walkFiles(join(CONVEX, "apps"), ".ts"),
    ...walkFiles(join(CONVEX, "lib"), ".ts"),
    ...walkFiles(join(CONVEX, "core"), ".ts"),
  ].filter(
    (f) =>
      !f.includes(".test.ts") &&
      !f.includes("Schema.ts") &&
      !f.includes("_generated"),
  );

  for (const file of backendFiles) {
    it(`${rel(file)}: must not use throw new Error()`, () => {
      const content = read(file);
      const hasBareThrow = content
        .split("\n")
        .some(
          (l) =>
            l.trim().includes("throw new Error(") &&
            !l.includes("// cherry:allow"),
        );
      expect(
        hasBareThrow,
        `${rel(file)}: throw new Error() — use errors.*`,
      ).toBe(false);
    });

    it(`${rel(file)}: must not use console.log`, () => {
      const content = read(file);
      const hasLog = content
        .split("\n")
        .some(
          (l) =>
            l.trim().startsWith("console.log(") &&
            !l.includes("// cherry:allow"),
        );
      expect(
        hasLog,
        `${rel(file)}: console.log — use console.warn/error`,
      ).toBe(false);
    });
  }
});

// =============================================================================
// 2. CROSS-DOMAIN ISOLATION
// =============================================================================

describe("2. Cross-Domain Isolation", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainFiles = walkFiles(
      join(CONVEX, "apps", domain),
      ".ts",
    ).filter((f) => !f.includes(".test.ts"));

    it(`${domain}: must not import other domain files`, () => {
      const otherDomains = domains.filter((d) => d !== domain);
      const violations: string[] = [];

      for (const file of domainFiles) {
        const content = read(file);
        const importLines = content
          .split("\n")
          .filter(
            (l) => l.trim().startsWith("import") && l.includes("from"),
          );

        for (const line of importLines) {
          for (const other of otherDomains) {
            if (
              line.includes(`/apps/${other}/`) &&
              !line.includes("// cherry:allow")
            ) {
              violations.push(
                `${rel(file)}: imports from "${other}" domain`,
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }

  it("core/: must not import apps/", () => {
    const coreFiles = walkFiles(join(CONVEX, "core"), ".ts");
    const violations: string[] = [];

    for (const file of coreFiles) {
      const content = read(file);
      const hasAppsImport = content
        .split("\n")
        .some(
          (l) =>
            l.includes("from") &&
            l.includes("/apps/") &&
            !l.includes("// cherry:allow"),
        );
      if (hasAppsImport) violations.push(rel(file));
    }

    expect(violations).toEqual([]);
  });
});

// =============================================================================
// 3. ANTI-PATTERN DETECTION
// =============================================================================

describe("3. Anti-Pattern Detection", () => {
  const appFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
    (f) => !f.includes(".test.ts"),
  );

  describe(".collect().length forbidden — use aggregate", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        expect(
          /\.collect\(\)\s*\.length/.test(content),
          `${rel(file)}: .collect().length — use aggregate`,
        ).toBe(false);
      });
    }
  });

  describe("Promise.all(ids.map(ctx.db.get)) forbidden — use getAll()", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasAntiPattern =
          content.includes("Promise.all") &&
          content.includes("ctx.db.get") &&
          content.includes(".map(");
        expect(
          hasAntiPattern,
          `${rel(file)}: Promise.all(ids.map(ctx.db.get)) — use getAll()`,
        ).toBe(false);
      });
    }
  });

  describe("fetch() only in integration files", () => {
    const nonIntegration = appFiles.filter(
      (f) => !f.endsWith("Integration.ts"),
    );

    for (const file of nonIntegration) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasFetch = content
          .split("\n")
          .some(
            (l) =>
              /\bfetch\s*\(/.test(l) && !l.includes("// cherry:allow"),
          );
        expect(
          hasFetch,
          `${rel(file)}: fetch() can only be used in .integration.ts`,
        ).toBe(false);
      });
    }
  });

  describe("ctx.db.insert('auditLogs') forbidden — use ctx.audit.log()", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasDirectAudit =
          content.includes('"auditLogs"') &&
          content.includes("ctx.db.insert") &&
          !content.includes("// cherry:allow");
        expect(
          hasDirectAudit,
          `${rel(file)}: ctx.db.insert("auditLogs") — use ctx.audit.log()`,
        ).toBe(false);
      });
    }
  });

  describe("ctx.scheduler forbidden in channel", () => {
    const channelFiles = walkFiles(
      join(CONVEX, "apps"),
      "Channel.ts",
    );

    for (const file of channelFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasScheduler =
          content.includes("ctx.scheduler") &&
          !content.includes("// cherry:allow");
        expect(
          hasScheduler,
          `${rel(file)}: ctx.scheduler — use scheduleTask()`,
        ).toBe(false);
      });
    }
  });

  describe("Integration files cannot use ctx.db (no direct DB access)", () => {
    const integrationFiles = walkFiles(
      join(CONVEX, "apps"),
      "Integration.ts",
    );

    for (const file of integrationFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasDb = content
          .split("\n")
          .some(
            (l) =>
              /\bctx\.db\b/.test(l) && !l.includes("// cherry:allow"),
          );
        expect(
          hasDb,
          `${rel(file)}: ctx.db in integration — use ctx.runQuery/runMutation instead`,
        ).toBe(false);
      });
    }
  });

  describe("Channel cannot import another domain's Business directly", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), "Channel.ts");

    for (const file of channelFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const violations: string[] = [];
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]!;
          if (!l.trim().startsWith("import")) continue;
          if (l.includes("// cherry:allow")) continue;
          // Channel may import its OWN business (same folder), but not
          // another domain's business file directly.
          if (
            l.includes("Business") &&
            l.includes("from") &&
            l.includes("../") &&
            !l.includes("./")
          ) {
            violations.push(`Line ${i + 1}: ${l.trim()}`);
          }
        }
        expect(
          violations,
          `${rel(file)}: cross-domain Business import — use ctx.runQuery(internal.apps.{domain}...) instead`,
        ).toHaveLength(0);
      });
    }
  });

  describe("No 'as any' in non-@ts-nocheck domain files", () => {
    const domainFiles = [
      ...walkFiles(join(CONVEX, "apps"), ".ts"),
      ...walkFiles(join(CONVEX, "core"), ".ts"),
    ].filter(
      (f) =>
        !f.includes("_generated") &&
        !f.includes("_template") &&
        !f.includes(".test."),
    );

    for (const file of domainFiles) {
      const content = read(file);
      // Skip @ts-nocheck files — they already have loose typing
      if (content.trimStart().startsWith("// @ts-nocheck")) continue;

      it(`${rel(file)}: no 'as any' casts`, () => {
        const violations: string[] = [];
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]!;
          if (l.includes("// cherry:allow")) continue;
          if (l.trim().startsWith("//")) continue;
          if (/\bas any\b/.test(l)) {
            violations.push(`Line ${i + 1}: ${l.trim()}`);
          }
        }
        expect(
          violations,
          `${rel(file)}: 'as any' cast — use proper typing or // cherry:allow`,
        ).toHaveLength(0);
      });
    }
  });
});

// =============================================================================
// 4. RATE LIMIT ENFORCEMENT
// =============================================================================

describe("4. Rate Limit Enforcement", () => {
  const channelFiles = walkFiles(join(CONVEX, "apps"), "Channel.ts");

  for (const file of channelFiles) {
    describe(`${rel(file)}`, () => {
      const content = read(file);
      const exportedMutations = [
        ...content.matchAll(
          /^export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/gm,
        ),
      ];

      const mutationExports = exportedMutations.filter(([, , wrapper]) => {
        return (
          !wrapper?.includes("Query") &&
          !wrapper?.includes("query") &&
          !wrapper?.includes("Action") &&
          !wrapper?.includes("action")
        );
      });

      if (mutationExports.length === 0) {
        it("skip: no channel mutation exports", () => {
          expect(true).toBe(true);
        });
      }

      for (const [, name, wrapper] of mutationExports) {
        it(`"${name}": must use rate-limited wrapper`, () => {
          const lineIdx = content
            .split("\n")
            .findIndex((l) => l.includes(`export const ${name}`));
          const nearby = content
            .split("\n")
            .slice(Math.max(0, lineIdx - 2), lineIdx + 2);
          const isBypassed = nearby.some((l) =>
            l.includes("// cherry:allow-no-rate-limit"),
          );

          if (!isBypassed) {
            expect(
              RATE_LIMITED_MUTATION_WRAPPERS,
              `"${name}" does not use rate-limited wrapper (used: "${wrapper}")`,
            ).toContain(wrapper);
          }
        });
      }
    });
  }
});
