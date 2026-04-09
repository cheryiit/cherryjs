/**
 * Backend Architecture Tests
 *
 * File naming, file size, import rules, layer content rules,
 * function naming, schema rules, and module structure requirements.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join, basename } from "path";
import {
  CONVEX,
  walkFiles,
  read,
  rel,
  lineCount,
  getDomains,
  hasLine,
  extractExportedNames,
  extractHandlerLineCounts,
  APPROVED_CONVEX_SUFFIXES,
  ALL_APPROVED_CHANNEL_WRAPPERS,
} from "../helpers";

// =============================================================================
// 1. FILE NAMING
// =============================================================================

describe("1. File Naming", () => {
  describe("apps/: must use approved suffix", () => {
    const appsFiles = walkFiles(join(CONVEX, "apps"), ".ts");

    for (const file of appsFiles) {
      it(`${rel(file)}: approved suffix`, () => {
        const name = basename(file);
        const hasApproved = APPROVED_CONVEX_SUFFIXES.some((s) =>
          name.endsWith(s),
        );
        expect(
          hasApproved,
          `${name} does not have approved suffix: ${APPROVED_CONVEX_SUFFIXES.join(", ")}`,
        ).toBe(true);
      });
    }
  });

  describe("apps/: file name must start with domain prefix", () => {
    const domains = getDomains();

    for (const domain of domains) {
      const domainFiles = walkFiles(
        join(CONVEX, "apps", domain),
        ".ts",
      );

      for (const file of domainFiles) {
        it(`${rel(file)}: "${domain}" prefix`, () => {
          const name = basename(file);
          // camelCase convention: "${domain}{Layer}.ts" e.g. usersBusiness.ts
          expect(
            name.startsWith(domain),
            `${name}: does not start with "${domain}" prefix`,
          ).toBe(true);
        });
      }
    }
  });

  describe("Forbidden file names", () => {
    const allConvexFiles = walkFiles(CONVEX, ".ts");
    const FORBIDDEN_PATTERNS = [
      /Util\.ts$/,
      /Helper\.ts$/,
      /Utils\.ts$/,
      /Helpers\.ts$/,
      /index\.ts$/,
    ];

    for (const file of allConvexFiles) {
      if (file.includes("_generated")) continue;

      it(`${rel(file)}: no forbidden name patterns`, () => {
        const name = basename(file);
        for (const pattern of FORBIDDEN_PATTERNS) {
          expect(
            pattern.test(name),
            `${name}: matches forbidden pattern "${pattern.source}"`,
          ).toBe(false);
        }
      });
    }
  });
});

// =============================================================================
// 2. FILE SIZE
// =============================================================================

describe("2. File Size", () => {
  const SIZE_LIMITS: Record<string, number> = {
    "Channel.ts": 200,
    "Model.ts": 300,
    "Schema.ts": 200,
    "Integration.ts": 300,
    "Business.ts": 500,
    "Batch.ts": 300,
  };

  for (const [suffix, maxLines] of Object.entries(SIZE_LIMITS)) {
    const files = walkFiles(join(CONVEX, "apps"), suffix);

    for (const file of files) {
      it(`${rel(file)}: max ${maxLines} lines`, () => {
        const content = read(file);
        const count = lineCount(content);
        expect(
          count,
          `${rel(file)}: ${count} lines (max: ${maxLines})`,
        ).toBeLessThanOrEqual(maxLines);
      });
    }
  }

  describe("Channel handler max 20 lines", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), "Channel.ts");

    for (const file of channelFiles) {
      it(`${rel(file)}: handlers max 20 lines`, () => {
        const content = read(file);
        const handlerSizes = extractHandlerLineCounts(content);

        for (const size of handlerSizes) {
          expect(
            size,
            `${rel(file)}: handler ${size} lines (max: 20)`,
          ).toBeLessThanOrEqual(20);
        }
      });
    }
  });
});

// =============================================================================
// 3. IMPORT RULES
// =============================================================================

describe("3. Import Rules", () => {
  describe("apps/: raw _generated builder import forbidden", () => {
    const appsFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".test.ts"),
    );

    for (const file of appsFiles) {
      if (
        file.endsWith("Business.ts") ||
        file.endsWith("Integration.ts") ||
        file.endsWith("Schedule.ts") ||
        file.endsWith("Batch.ts")
      )
        continue;

      it(`${rel(file)}: no raw builder import`, () => {
        const content = read(file);
        const hasRawImport = content.split("\n").some(
          (l) =>
            l.includes("from") &&
            l.includes("_generated/server") &&
            /\b(query|mutation|action)\b/.test(l) &&
            !l.includes("internalQuery") &&
            !l.includes("internalMutation") &&
            !l.includes("internalAction") &&
            !l.includes("// cherry:allow"),
        );
        expect(
          hasRawImport,
          `${rel(file)}: raw _generated/server builder import found`,
        ).toBe(false);
      });
    }
  });

  describe("model/: Convex builder import forbidden", () => {
    const modelFiles = walkFiles(join(CONVEX, "apps"), "Model.ts");
    const coreModelFiles = walkFiles(CONVEX, "Model.ts").filter((f) =>
      f.includes("/core/"),
    );

    for (const file of [...modelFiles, ...coreModelFiles]) {
      it(`${rel(file)}: no Convex builder`, () => {
        const content = read(file);
        const hasBuilder = content.split("\n").some(
          (l) =>
            !l.trim().startsWith("import") &&
            !l.trim().startsWith("//") &&
            /=\s*(internalMutation|internalQuery|internalAction|mutation|query|action)\s*\(/.test(l),
        );
        expect(
          hasBuilder,
          `${rel(file)}: Convex builder found in model file`,
        ).toBe(false);
      });
    }
  });

  describe("Barrel export forbidden", () => {
    const indexFiles = walkFiles(CONVEX, ".ts").filter(
      (f) => basename(f) === "index.ts" && !f.includes("_generated"),
    );

    it("no index.ts under convex/", () => {
      expect(
        indexFiles.map(rel),
        `Barrel export files found`,
      ).toHaveLength(0);
    });
  });

  // ── lib/ standalone enforcement ────────────────────────────────────────────
  // The dependency-cruiser config enforces this at the build level too,
  // but having an arch test gives a clearer error pointing to the exact
  // line. lib/ files must NEVER import from convex/core/ or convex/apps/.
  describe("lib/: must be standalone (no apps/ or core/ imports)", () => {
    const libFiles = walkFiles(join(CONVEX, "lib"), ".ts");

    for (const file of libFiles) {
      it(`${rel(file)}: no apps/ or core/ imports`, () => {
        const content = read(file);
        const violations: string[] = [];
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]!;
          if (l.includes("// cherry:allow")) continue;
          if (!l.trim().startsWith("import")) continue;
          if (
            (l.includes("../apps/") || l.includes("../core/")) &&
            !l.includes("_generated")
          ) {
            violations.push(`Line ${i + 1}: ${l.trim()}`);
          }
        }
        expect(
          violations,
          `${rel(file)}: lib/ files must be standalone:\n${violations.join("\n")}`,
        ).toHaveLength(0);
      });
    }
  });

  // ── Domain *Business.ts files must use businessMutation/Query ──────────────
  // Workaround for Convex issue #53 (TS2589). Raw `internalMutation` from
  // `_generated/server` triggers deep type inference once schemas grow;
  // the lib/functions re-exports collapse the generic. Domain files must
  // import from `lib/functions` instead.
  describe("apps|core *Business.ts: must use lib/functions builders", () => {
    const businessFiles = [
      ...walkFiles(join(CONVEX, "apps"), "Business.ts"),
      ...walkFiles(join(CONVEX, "core"), "Business.ts"),
    ].filter((f) => !f.includes(".test."));

    for (const file of businessFiles) {
      it(`${rel(file)}: imports builders from lib/functions`, () => {
        const content = read(file);
        // Skip files that have a top-of-file ts-nocheck — they may
        // legitimately use raw builders during transition. The "businessQuery"
        // import requirement still applies for new files.
        const hasRawValueImport = content
          .split("\n")
          .some(
            (l) =>
              l.trim().startsWith("import") &&
              !l.includes("import type") &&
              l.includes("_generated/server") &&
              /\b(internalMutation|internalQuery|internalAction)\b/.test(l) &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasRawValueImport,
          `${rel(file)}: imports raw internal builders — use businessMutation/Query/Action from lib/functions instead (Convex issue #53 workaround)`,
        ).toBe(false);
      });
    }
  });
});

// =============================================================================
// 4. LAYER CONTENT RULES
// =============================================================================

describe("4. Layer Content Rules", () => {
  describe("Business: only internal builder exports", () => {
    const businessFiles = walkFiles(join(CONVEX, "apps"), "Business.ts");

    for (const file of businessFiles) {
      it(`${rel(file)}: only internal exports`, () => {
        const content = read(file);
        const exportLines = content
          .split("\n")
          .filter(
            (l) =>
              l.trim().startsWith("export const") &&
              !l.includes("// cherry:allow"),
          );

        for (const line of exportLines) {
          const isInternal =
            line.includes("internalMutation(") ||
            line.includes("internalQuery(") ||
            line.includes("internalAction(") ||
            // Domain files use the re-exported aliases from lib/functions
            // to work around Convex TS2589 (see lib/functions.ts comment).
            line.includes("businessMutation(") ||
            line.includes("businessQuery(") ||
            line.includes("businessAction(");
          const isReexport = !line.includes("(");
          expect(
            isInternal || isReexport,
            `${rel(file)}: "${line.trim()}" does not use internal/business builder`,
          ).toBe(true);
        }
      });
    }
  });

  describe("Integration: only internalAction exports", () => {
    const integrationFiles = walkFiles(
      join(CONVEX, "apps"),
      "Integration.ts",
    );

    if (integrationFiles.length === 0) {
      it("skip: no integration files yet", () => {
        expect(true).toBe(true);
      });
    }

    for (const file of integrationFiles) {
      it(`${rel(file)}: only internalAction`, () => {
        const content = read(file);
        const hasWrongBuilder = content.split("\n").some(
          (l) =>
            l.trim().startsWith("export const") &&
            (l.includes("internalMutation(") ||
              l.includes("internalQuery(") ||
              l.includes("query(") ||
              l.includes("mutation(")) &&
            !l.includes("// cherry:allow"),
        );
        expect(
          hasWrongBuilder,
          `${rel(file)}: integration can only use internalAction`,
        ).toBe(false);
      });
    }
  });

  describe("Channel: must use approved wrapper", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), "Channel.ts");

    for (const file of channelFiles) {
      it(`${rel(file)}: only approved wrapper exports`, () => {
        const content = read(file);
        const exportedConst = content.matchAll(
          /export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g,
        );
        for (const match of exportedConst) {
          const wrapperUsed = match[2]!;
          expect(
            ALL_APPROVED_CHANNEL_WRAPPERS,
            `${rel(file)}: "${match[1]}" uses "${wrapperUsed}" which is not an approved wrapper`,
          ).toContain(wrapperUsed);
        }
      });
    }
  });
});

// =============================================================================
// 5. FUNCTION NAMING
// =============================================================================

describe("5. Function Naming", () => {
  describe("Model: must start with get/list/exists/count/find", () => {
    const modelFiles = [
      ...walkFiles(join(CONVEX, "apps"), "Model.ts"),
      ...walkFiles(CONVEX, "Model.ts").filter((f) =>
        f.includes("/core/"),
      ),
    ];

    for (const file of modelFiles) {
      it(`${rel(file)}: correct function names`, () => {
        const content = read(file);
        const names = extractExportedNames(content);
        for (const name of names) {
          expect(
            name,
            `model function "${name}" does not start with get/list/exists/count/find`,
          ).toMatch(/^(get|list|exists|count|find)/);
        }
      });
    }
  });
});

// =============================================================================
// 6. SCHEMA RULES
// =============================================================================

// camelCase file naming helper: ("users", "business") → "usersBusiness.ts"
function moduleFile(domain: string, layer: string): string {
  const cap = layer.charAt(0).toUpperCase() + layer.slice(1);
  return `${domain}${cap}.ts`;
}

describe("6. Schema Rules", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const schemaFile = join(
      CONVEX,
      "apps",
      domain,
      moduleFile(domain, "schema"),
    );
    if (!existsSync(schemaFile)) continue;

    it(`${domain}Schema.ts: must export ${domain}Tables`, () => {
      const content = read(schemaFile);
      expect(content).toContain(`export const ${domain}Tables`);
    });

    it(`${domain}Schema.ts: must export field definitions`, () => {
      const content = read(schemaFile);
      const hasFieldExport =
        content.includes("export const") && content.includes("Fields");
      expect(
        hasFieldExport,
        `${domain}Schema.ts: *Fields export not found`,
      ).toBe(true);
    });
  }

  it("schema.ts: must NOT contain defineTable() directly", () => {
    const content = read(join(CONVEX, "schema.ts"));
    const hasDirectTable = hasLine(content, /defineTable\s*\(/);
    expect(
      hasDirectTable,
      "schema.ts contains defineTable directly — move to domain schemas",
    ).toBe(false);
  });
});

// =============================================================================
// 7. MODULE STRUCTURE REQUIREMENTS
// =============================================================================

describe("7. Module Structure Requirements", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainDir = join(CONVEX, "apps", domain);

    it(`${domain}: ${moduleFile(domain, "channel")} must exist`, () => {
      expect(
        existsSync(join(domainDir, moduleFile(domain, "channel"))),
      ).toBe(true);
    });

    it(`${domain}: ${moduleFile(domain, "business")} must exist`, () => {
      expect(
        existsSync(join(domainDir, moduleFile(domain, "business"))),
      ).toBe(true);
    });

    it(`${domain}: ${moduleFile(domain, "schema")} must exist`, () => {
      expect(
        existsSync(join(domainDir, moduleFile(domain, "schema"))),
      ).toBe(true);
    });

    it(`${domain}: must be included in schema aggregator`, () => {
      const rootSchema = read(join(CONVEX, "schema.ts"));
      const isIncluded =
        rootSchema.includes(`${domain}Schema`) ||
        rootSchema.includes(`${domain}Tables`);
      expect(
        isIncluded,
        `${domain} not added to schema.ts aggregator`,
      ).toBe(true);
    });
  }

  const CORE_MODULES = ["schedule", "parameter", "webhook", "audit", "content"];

  for (const mod of CORE_MODULES) {
    it(`core/${mod}: model file must exist`, () => {
      expect(
        existsSync(join(CONVEX, "core", mod, moduleFile(mod, "model"))),
      ).toBe(true);
    });
  }
});

// =============================================================================
// 8. TEST EXISTENCE
// =============================================================================

describe("8. Test Existence", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const businessFile = join(
      CONVEX,
      "apps",
      domain,
      moduleFile(domain, "business"),
    );

    if (!existsSync(businessFile)) continue;

    it.skip(`${domain}: ${domain}Business.test.ts must exist`, () => {
      expect(
        existsSync(
          join(CONVEX, "apps", domain, `${domain}Business.test.ts`),
        ),
      ).toBe(true);
    });
  }
});
