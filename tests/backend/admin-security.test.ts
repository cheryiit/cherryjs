// Admin Security Enforcement Tests
//
// The single most dangerous mistake AI can make: opening an admin-only
// channel mutation to regular users by accident. This test prevents that.
//
// Convention: any channel export marked with /** @admin (closing) JSDoc MUST
// use an admin wrapper. Any export marked with /** @critical (closing)
// MUST use strictMutation or adminRateLimitedMutation.
//
// Also enforces:
// - Role enum in users.schema.ts must match Role enum in lib/permissions.ts
// - Admin wrappers only used in channel layer (not in business/model)
// - Every admin mutation must call ctx.audit
import { describe, it, expect } from "vitest";
import { join } from "path";
import { CONVEX, walkFiles, read, rel } from "../helpers";

const ADMIN_QUERY_WRAPPERS = ["adminQuery"];
const ADMIN_MUTATION_WRAPPERS = [
  "adminMutation",
  "adminRateLimitedMutation",
];
const ALL_ADMIN_WRAPPERS = [...ADMIN_QUERY_WRAPPERS, ...ADMIN_MUTATION_WRAPPERS];

// =============================================================================
// 1. @admin MARKER ENFORCEMENT
// =============================================================================

describe("Admin Security: 1. @admin marker enforcement", () => {
  const channelFiles = [
    ...walkFiles(join(CONVEX, "apps"), "Channel.ts"),
    ...walkFiles(join(CONVEX, "core"), "Channel.ts"),
  ];

  let foundAny = false;
  for (const file of channelFiles) {
    const content = read(file);
    const adminMarkerRegex =
      /\/\*\*[\s\S]*?@admin\b[\s\S]*?\*\/\s*export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g;

    const markedExports = [...content.matchAll(adminMarkerRegex)];
    if (markedExports.length === 0) continue;
    foundAny = true;

    for (const [, name, wrapper] of markedExports) {
      it(`${rel(file)}: @admin "${name}" must use admin wrapper`, () => {
        expect(
          ALL_ADMIN_WRAPPERS,
          `"${name}" is marked @admin but uses "${wrapper}" — must be one of: ${ALL_ADMIN_WRAPPERS.join(", ")}`,
        ).toContain(wrapper);
      });
    }
  }

  if (!foundAny) {
    it("skip: no @admin markers found yet", () => {
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 2. ADMIN WRAPPER ONLY IN CHANNEL LAYER
// =============================================================================

describe("Admin Security: 2. Admin wrappers only in channel layer", () => {
  const nonChannelFiles = [
    ...walkFiles(join(CONVEX, "apps"), ".ts"),
    ...walkFiles(join(CONVEX, "core"), ".ts"),
  ].filter(
    (f) =>
      !f.includes("Channel.ts") &&
      !f.includes(".test.ts") &&
      !f.includes("Schema.ts") &&
      !f.includes("_generated"),
  );

  for (const file of nonChannelFiles) {
    it(`${rel(file)}: must not use admin wrappers (only in channel layer)`, () => {
      const content = read(file);
      const violations: string[] = [];

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("// cherry:allow")) continue;
        if (line.trim().startsWith("//")) continue;
        if (line.trim().startsWith("import")) continue;

        for (const wrapper of ALL_ADMIN_WRAPPERS) {
          // Match wrapper as a function call: adminQuery(, adminMutation(
          const callRegex = new RegExp(`\\b${wrapper}\\s*\\(`);
          if (callRegex.test(line)) {
            violations.push(
              `Line ${i + 1}: "${wrapper}" used outside channel layer`,
            );
          }
        }
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
    });
  }
});

// =============================================================================
// 3. ROLE ENUM SYNC (schema ↔ permissions)
// =============================================================================

describe("Admin Security: 3. Role enum sync", () => {
  it("usersSchema.ts role union matches lib/permissions.ts Role enum", () => {
    const schemaContent = read(
      join(CONVEX, "apps", "users", "usersSchema.ts"),
    );
    const permissionsContent = read(
      join(CONVEX, "lib", "permissions.ts"),
    );

    // Extract role literals from schema: handles nested v.union(v.literal("admin"), ...)
    const schemaRoleMatch = schemaContent.match(
      /role:\s*v\.union\(((?:[^()]|\([^)]*\))*)\)/,
    );
    expect(
      schemaRoleMatch,
      "users.schema.ts: role field with v.union(...) not found",
    ).toBeTruthy();

    const schemaRoles = [
      ...schemaRoleMatch![1]!.matchAll(/v\.literal\(\s*["'](\w+)["']\s*\)/g),
    ].map((m) => m[1]!);

    const permissionRoleBlock = permissionsContent.match(
      /export\s+const\s+Role\s*=\s*\{([\s\S]*?)\}/,
    );
    expect(
      permissionRoleBlock,
      "lib/permissions.ts: export const Role = {...} not found",
    ).toBeTruthy();

    const permRoles = [
      ...permissionRoleBlock![1]!.matchAll(/["'](\w+)["']/g),
    ].map((m) => m[1]!);

    // Both lists should have the same set of roles
    const schemaSet = new Set(schemaRoles);
    const permSet = new Set(permRoles);

    const missingInPerm = [...schemaSet].filter((r) => !permSet.has(r));
    const missingInSchema = [...permSet].filter((r) => !schemaSet.has(r));

    expect(
      missingInPerm,
      `Roles in users.schema.ts but missing in lib/permissions.ts Role: ${missingInPerm.join(", ")}`,
    ).toHaveLength(0);
    expect(
      missingInSchema,
      `Roles in lib/permissions.ts Role but missing in users.schema.ts: ${missingInSchema.join(", ")}`,
    ).toHaveLength(0);
  });
});

// =============================================================================
// 4. CRITICAL OPERATIONS MUST USE strictMutation OR adminRateLimitedMutation
// =============================================================================

describe("Admin Security: 4. Critical operation markers", () => {
  const channelFiles = [
    ...walkFiles(join(CONVEX, "apps"), "Channel.ts"),
    ...walkFiles(join(CONVEX, "core"), "Channel.ts"),
  ];

  const CRITICAL_WRAPPERS = ["strictMutation", "adminRateLimitedMutation"];

  let foundAny = false;
  for (const file of channelFiles) {
    const content = read(file);
    const criticalRegex =
      /\/\*\*[\s\S]*?@critical\b[\s\S]*?\*\/\s*export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g;

    const markedExports = [...content.matchAll(criticalRegex)];
    if (markedExports.length === 0) continue;
    foundAny = true;

    for (const [, name, wrapper] of markedExports) {
      it(`${rel(file)}: @critical "${name}" must use strictMutation or adminRateLimitedMutation`, () => {
        expect(
          CRITICAL_WRAPPERS,
          `"${name}" is marked @critical but uses "${wrapper}" — must be one of: ${CRITICAL_WRAPPERS.join(", ")}`,
        ).toContain(wrapper);
      });
    }
  }

  if (!foundAny) {
    it("skip: no @critical markers found yet", () => {
      expect(true).toBe(true);
    });
  }
});

// =============================================================================
// 5. ADMIN OPERATIONS MUST AUDIT
// =============================================================================

describe("Admin Security: 5. Admin mutations must call ctx.audit", () => {
  const channelFiles = [
    ...walkFiles(join(CONVEX, "apps"), "Channel.ts"),
    ...walkFiles(join(CONVEX, "core"), "Channel.ts"),
  ];

  let foundAny = false;
  for (const file of channelFiles) {
    const content = read(file);
    const adminMutationRegex =
      /export\s+const\s+(\w+)\s*=\s*adminRateLimitedMutation\s*\(\s*\{[\s\S]*?handler:\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s*\},?\s*\}\s*\)/g;

    const matches = [...content.matchAll(adminMutationRegex)];
    if (matches.length === 0) continue;
    foundAny = true;

    for (const [, name, body] of matches) {
      it(`${rel(file)}: admin mutation "${name}" must call ctx.audit`, () => {
        const hasAudit =
          body!.includes("ctx.audit.") ||
          body!.includes("// cherry:allow-no-audit");
        expect(
          hasAudit,
          `"${name}" is an admin mutation but does not call ctx.audit.log/warn/critical — every admin write should be audited`,
        ).toBe(true);
      });
    }
  }

  if (!foundAny) {
    it("skip: no admin mutations found yet", () => {
      expect(true).toBe(true);
    });
  }
});
