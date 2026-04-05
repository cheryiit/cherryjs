/**
 * Tech Adoption Enforcement Tests
 *
 * These tests detect situations where a convex-helpers or @convex-dev
 * feature SHOULD be used but isn't. Two severity levels:
 *
 * - [FAIL]     Hard rule violation — must be fixed
 * - [ADVISORY] Improvement opportunity — logged as warning
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const CONVEX = join(ROOT, "convex");

function walkFiles(dir: string, ext?: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full, ext));
    } else if (!ext || full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

function rel(path: string): string {
  return relative(ROOT, path);
}

const appFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
  (f) => !f.includes(".test.ts") && !f.includes(".schema.ts"),
);

const businessFiles = appFiles.filter((f) => f.endsWith(".business.ts"));
const channelFiles = appFiles.filter((f) => f.endsWith(".channel.ts"));
const modelFiles = appFiles.filter((f) => f.endsWith(".model.ts"));
const coreFiles = walkFiles(join(CONVEX, "core"), ".ts").filter(
  (f) => !f.includes(".schema.ts"),
);

// =============================================================================
// 1. RELATIONSHIP HELPERS — getAll/getManyFrom instead of manual joins
// =============================================================================

describe("[FAIL] Relationship helpers should be used", () => {
  const files = [...businessFiles, ...modelFiles];

  for (const file of files) {
    it(`${rel(file)}: no Promise.all + ctx.db.get (use getAll)`, () => {
      const content = read(file);
      const hasAntiPattern =
        content.includes("Promise.all") &&
        content.includes("ctx.db.get") &&
        content.includes(".map(") &&
        !content.includes("// cherry:allow");
      expect(hasAntiPattern).toBe(false);
    });
  }
});

// =============================================================================
// 2. FILTER HELPER — complex JS predicates on queries
// =============================================================================

describe("[ADVISORY] filter() helper opportunities", () => {
  for (const file of businessFiles) {
    it(`${rel(file)}: .collect() + .filter() pattern detected`, () => {
      const content = read(file);
      // Detect: .collect() followed by .filter() — should use filter() from convex-helpers
      const hasCollectFilter =
        /\.collect\(\)\s*;?\s*\n?\s*\w+\s*=\s*\w+\.filter\(/.test(content) ||
        /\.collect\(\)\.filter\(/.test(content);

      if (hasCollectFilter && !content.includes("// cherry:allow")) {
        console.warn(
          `⚠️  ${rel(file)}: .collect().filter() detected — consider using filter() from lib/filter.ts for better performance`,
        );
      }
      // Advisory — does not fail
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 3. ERROR FACTORY — errors.* instead of new ConvexError
// =============================================================================

describe("[FAIL] Must use errors.* factory", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    it(`${rel(file)}: no new ConvexError() (use errors.*)`, () => {
      const content = read(file);
      const hasDirectConvexError = content
        .split("\n")
        .some(
          (l) =>
            /new ConvexError\(/.test(l) &&
            !l.includes("// cherry:allow") &&
            !l.trim().startsWith("//"),
        );
      expect(hasDirectConvexError).toBe(false);
    });
  }
});

// =============================================================================
// 4. RATE LIMITER — must use lib/rate-limiter.ts instance
// =============================================================================

describe("[FAIL] Must use shared rate limiter instance", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    // Skip lib/rate-limiter.ts itself
    if (file.endsWith("rate-limiter.ts")) continue;

    it(`${rel(file)}: no new RateLimiter() (use lib/rate-limiter.ts)`, () => {
      const content = read(file);
      const hasNewInstance = content
        .split("\n")
        .some(
          (l) =>
            /new RateLimiter\(/.test(l) && !l.includes("// cherry:allow"),
        );
      expect(hasNewInstance).toBe(false);
    });
  }
});

// =============================================================================
// 5. WORKFLOW — detect multi-step scheduler chains
// =============================================================================

describe("[ADVISORY] Workflow opportunities", () => {
  for (const file of businessFiles) {
    it(`${rel(file)}: multi-step scheduler chain detected`, () => {
      const content = read(file);
      const schedulerCalls = (
        content.match(/ctx\.scheduler\.runAfter/g) ?? []
      ).length;
      if (schedulerCalls >= 3) {
        console.warn(
          `⚠️  ${rel(file)}: ${schedulerCalls} scheduler.runAfter calls — consider @convex-dev/workflow`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 6. AGGREGATE — detect collect().length counting
// =============================================================================

describe("[FAIL] Must use aggregate for counting", () => {
  const files = [...businessFiles, ...channelFiles];

  for (const file of files) {
    it(`${rel(file)}: no .collect().length (use aggregate)`, () => {
      const content = read(file);
      const hasCountPattern =
        /\.collect\(\)\s*\.length/.test(content) &&
        !content.includes("// cherry:allow");
      expect(hasCountPattern).toBe(false);
    });
  }
});

// =============================================================================
// 7. AUDIT — must use ctx.audit helper
// =============================================================================

describe("[FAIL] Must use ctx.audit helper", () => {
  for (const file of appFiles) {
    it(`${rel(file)}: no direct auditLogs insert`, () => {
      const content = read(file);
      const hasDirect =
        content.includes('"auditLogs"') &&
        content.includes("ctx.db.insert") &&
        !content.includes("// cherry:allow");
      expect(hasDirect).toBe(false);
    });
  }
});

// =============================================================================
// 8. RETRIER — detect try/catch + scheduler retry in integrations
// =============================================================================

describe("[ADVISORY] Action retrier opportunities", () => {
  const integrationFiles = appFiles.filter((f) =>
    f.endsWith(".integration.ts"),
  );

  for (const file of integrationFiles) {
    it(`${rel(file)}: manual retry pattern detected`, () => {
      const content = read(file);
      const hasManualRetry =
        content.includes("catch") &&
        content.includes("scheduler.runAfter") &&
        !content.includes("retrier");

      if (hasManualRetry) {
        console.warn(
          `⚠️  ${rel(file)}: try/catch + scheduler retry — consider lib/retrier.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 9. VALIDATORS — use literals() instead of verbose v.union(v.literal())
// =============================================================================

describe("[ADVISORY] Validator helper opportunities", () => {
  const schemaFiles = walkFiles(CONVEX, ".schema.ts");

  for (const file of schemaFiles) {
    it(`${rel(file)}: verbose v.union(v.literal()) pattern`, () => {
      const content = read(file);
      // Count v.union(v.literal(...), v.literal(...), v.literal(...)) with 3+ literals
      const verboseUnions = content.match(
        /v\.union\(\s*(?:v\.literal\([^)]+\)\s*,\s*){3,}/g,
      );

      if (verboseUnions && verboseUnions.length > 0) {
        console.warn(
          `⚠️  ${rel(file)}: ${verboseUnions.length} verbose v.union(v.literal()) — consider literals() from lib/validators.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 10. STORAGE — presigned URL pattern enforcement
// =============================================================================

describe("[FAIL] Storage must use lib/storage.ts", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    // Skip lib/storage.ts itself
    if (file.endsWith("storage.ts") && file.includes("/lib/")) continue;

    it(`${rel(file)}: no direct S3Client instantiation`, () => {
      const content = read(file);
      const hasDirect = content
        .split("\n")
        .some(
          (l) =>
            /new S3Client\(/.test(l) && !l.includes("// cherry:allow"),
        );
      expect(hasDirect).toBe(false);
    });
  }
});

// =============================================================================
// 11. EMAIL — must use lib/email.ts Resend instance
// =============================================================================

describe("[FAIL] Email must use lib/email.ts", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    if (file.endsWith("email.ts") && file.includes("/lib/")) continue;

    it(`${rel(file)}: no new Resend() (use lib/email.ts)`, () => {
      const content = read(file);
      const hasNewResend = content
        .split("\n")
        .some(
          (l) =>
            /new Resend\(/.test(l) && !l.includes("// cherry:allow"),
        );
      expect(hasNewResend).toBe(false);
    });
  }
});

// =============================================================================
// 12. WEBHOOK VERIFY — must use lib/webhook-verify.ts
// =============================================================================

describe("[FAIL] Webhook verification must use lib/webhook-verify.ts", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    if (file.includes("webhook-verify.ts")) continue;

    it(`${rel(file)}: no manual HMAC verification`, () => {
      const content = read(file);
      const hasManualHmac =
        content.includes("crypto.subtle.sign") &&
        content.includes("HMAC") &&
        !content.includes("// cherry:allow");
      expect(hasManualHmac).toBe(false);
    });
  }
});

// =============================================================================
// 13. MIGRATION — must use lib/migrations.ts
// =============================================================================

describe("[ADVISORY] Migration helper opportunities", () => {
  for (const file of businessFiles) {
    it(`${rel(file)}: batch cursor pattern detected`, () => {
      const content = read(file);
      const hasBatchCursor =
        content.includes("cursor") &&
        content.includes("scheduler.runAfter") &&
        content.includes("batchSize") &&
        !content.includes("migration");

      if (hasBatchCursor) {
        console.warn(
          `⚠️  ${rel(file)}: manual batch+cursor pattern — consider lib/migrations.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});
