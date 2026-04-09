/**
 * Backend lib/ Integrity Tests
 *
 * Ensures shared infrastructure modules exist, export required symbols,
 * and stay in sync (e.g., rateLimiter configs match usage).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { CONVEX, read } from "../helpers";

// =============================================================================
// 1. LIB INTEGRITY
// =============================================================================

describe("1. lib/ Integrity", () => {
  it("lib/functions.ts: must export required wrappers", () => {
    const content = read(join(CONVEX, "lib", "functions.ts"));
    const REQUIRED = [
      "publicQuery",
      "publicMutation",
      "publicAction",
      "authenticatedQuery",
      "authenticatedMutation",
      "authenticatedAction",
      "adminQuery",
      "adminMutation",
      "strictMutation",
      "normalMutation",
      "relaxedMutation",
      "burstMutation",
      "adminRateLimitedMutation",
      "publicStrictMutation",
      "activeSystemMutation",
      "verifiedUserMutation",
      "internalAuthQuery",
      "internalAuthMutation",
      "internalAuthAction",
    ];

    for (const name of REQUIRED) {
      expect(
        content,
        `lib/functions.ts: "export const ${name}" not found`,
      ).toContain(`export const ${name}`);
    }
  });

  it("lib/errors.ts: must have required exports", () => {
    const content = read(join(CONVEX, "lib", "errors.ts"));
    expect(content).toContain("export const ErrorCode");
    expect(content).toContain("export const errors");
    expect(content).toContain("export function isAppError");
  });

  it("lib/permissions.ts: must have required exports", () => {
    const content = read(join(CONVEX, "lib", "permissions.ts"));
    expect(content).toContain("export const Role");
    expect(content).toContain("export const Permission");
    expect(content).toContain("export function hasPermission");
    expect(content).toContain("export function canPerform");
  });

  it("lib/rateLimiter.ts: must exist", () => {
    expect(existsSync(join(CONVEX, "lib", "rateLimiter.ts"))).toBe(true);
  });

  it("lib/audit.ts: must exist", () => {
    expect(existsSync(join(CONVEX, "lib", "audit.ts"))).toBe(true);
  });

  it("lib/requestContext.ts: must exist", () => {
    expect(existsSync(join(CONVEX, "lib", "requestContext.ts"))).toBe(
      true,
    );
  });
});

// =============================================================================
// 2. LIB WRAPPER SYNC
// =============================================================================

describe("2. lib/ Wrapper Sync", () => {
  it("lib/functions.ts: rateLimiter configs in sync", () => {
    const functionsContent = read(join(CONVEX, "lib", "functions.ts"));
    const rateLimiterContent = read(
      join(CONVEX, "lib", "rateLimiter.ts"),
    );

    const usedConfigs = [
      ...functionsContent.matchAll(
        /rateLimiter\.limit\(ctx,\s*["'](\w[\w-]*)["']/g,
      ),
    ].map((m) => m[1]!);

    for (const config of usedConfigs) {
      const found =
        rateLimiterContent.includes(`"${config}"`) ||
        rateLimiterContent.includes(`'${config}'`) ||
        new RegExp(`\\b${config.replace("-", "\\-")}\\s*:`).test(rateLimiterContent);
      expect(
        found,
        `lib/rateLimiter.ts: "${config}" config not defined`,
      ).toBe(true);
    }
  });

  it("All required lib files must exist", () => {
    const REQUIRED_LIB_FILES = [
      "audit.ts",
      "cors.ts",
      "email.ts",
      "errors.ts",
      "filter.ts",
      "functions.ts",
      "migrations.ts",
      "permissions.ts",
      "polar.ts",
      "rateLimiter.ts",
      "relationships.ts",
      "requestContext.ts",
      "retrier.ts",
      "rls.ts",
      "search.ts",
      "sessions.ts",
      "settings.ts",
      "storage.ts",
      "validators.ts",
      "workflow.ts",
    ];

    for (const file of REQUIRED_LIB_FILES) {
      expect(
        existsSync(join(CONVEX, "lib", file)),
        `lib/${file} not found`,
      ).toBe(true);
    }
  });
});
