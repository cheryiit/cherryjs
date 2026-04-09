/**
 * Tech Adoption Enforcement Tests
 *
 * Detects situations where a convex-helpers or @convex-dev feature
 * SHOULD be used but isn't. Two severity levels:
 *
 * - [FAIL]     Hard rule violation — must be fixed
 * - [ADVISORY] Improvement opportunity — logged as warning
 */
import { describe, it, expect } from "vitest";
import { join } from "path";
import { CONVEX, walkFiles, read, rel } from "../helpers";

const appFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
  (f) => !f.includes(".test.ts") && !f.includes("Schema.ts"),
);

const businessFiles = appFiles.filter((f) => f.endsWith("Business.ts"));
const channelFiles = appFiles.filter((f) => f.endsWith("Channel.ts"));
const modelFiles = appFiles.filter((f) => f.endsWith("Model.ts"));
const coreFiles = walkFiles(join(CONVEX, "core"), ".ts").filter(
  (f) => !f.includes("Schema.ts"),
);

// =============================================================================
// 1. RELATIONSHIP HELPERS
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
// 2. FILTER HELPER
// =============================================================================

describe("[ADVISORY] filter() helper opportunities", () => {
  for (const file of businessFiles) {
    it(`${rel(file)}: .collect() + .filter() pattern detected`, () => {
      const content = read(file);
      const hasCollectFilter =
        /\.collect\(\)\s*;?\s*\n?\s*\w+\s*=\s*\w+\.filter\(/.test(content) ||
        /\.collect\(\)\.filter\(/.test(content);

      if (hasCollectFilter && !content.includes("// cherry:allow")) {
        console.warn(
          `  ${rel(file)}: .collect().filter() detected — consider using filter() from lib/filter.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 3. ERROR FACTORY
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
// 4. RATE LIMITER
// =============================================================================

describe("[FAIL] Must use shared rate limiter instance", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    if (file.endsWith("rateLimiter.ts")) continue;

    it(`${rel(file)}: no new RateLimiter() (use lib/rateLimiter.ts)`, () => {
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
// 5. WORKFLOW
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
          `  ${rel(file)}: ${schedulerCalls} scheduler.runAfter calls — consider @convex-dev/workflow`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 6. AGGREGATE
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
// 7. AUDIT
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
// 8. RETRIER
// =============================================================================

describe("[ADVISORY] Action retrier opportunities", () => {
  const integrationFiles = appFiles.filter((f) =>
    f.endsWith("Integration.ts"),
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
          `  ${rel(file)}: try/catch + scheduler retry — consider lib/retrier.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 9. VALIDATORS
// =============================================================================

describe("[ADVISORY] Validator helper opportunities", () => {
  const schemaFiles = walkFiles(CONVEX, "Schema.ts");

  for (const file of schemaFiles) {
    it(`${rel(file)}: verbose v.union(v.literal()) pattern`, () => {
      const content = read(file);
      const verboseUnions = content.match(
        /v\.union\(\s*(?:v\.literal\([^)]+\)\s*,\s*){3,}/g,
      );

      if (verboseUnions && verboseUnions.length > 0) {
        console.warn(
          `  ${rel(file)}: ${verboseUnions.length} verbose v.union(v.literal()) — consider literals() from lib/validators.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 10. STORAGE
// =============================================================================

describe("[FAIL] Storage must use lib/storage.ts", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
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
// 11. EMAIL
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
// 12. WEBHOOK VERIFY — no manual HMAC, use a Convex component
// =============================================================================

describe("[FAIL] Webhook verification must go through a component", () => {
  const files = [...appFiles, ...coreFiles];

  for (const file of files) {
    it(`${rel(file)}: no manual HMAC verification`, () => {
      const content = read(file);
      // Components like @convex-dev/polar handle webhook signature
      // verification internally. Manual HMAC in domain code is forbidden —
      // use the component's registerRoutes(http) instead.
      const hasManualHmac =
        content.includes("crypto.subtle.sign") &&
        content.includes("HMAC") &&
        !content.includes("// cherry:allow");
      expect(hasManualHmac).toBe(false);
    });
  }
});

// =============================================================================
// 13. MIGRATION
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
          `  ${rel(file)}: manual batch+cursor pattern — consider lib/migrations.ts`,
        );
      }
      expect(true).toBe(true);
    });
  }
});
