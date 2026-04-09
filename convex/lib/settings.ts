/**
 * Settings — Type-Safe Wrapper Over Parameters
 *
 * The `parameters` table stores all dynamic configuration as
 * `(domain, key, value)` triples. This module provides a type-safe
 * read interface that knows about all valid scopes and keys.
 *
 * USAGE:
 *
 *   import { settings } from "../lib/settings";
 *
 *   // Read with default fallback
 *   const limit = await settings.getNumber(ctx, "withdraw", "dailyLimit", 1000);
 *   const isEnabled = await settings.getBoolean(ctx, "feature", "newCheckout", false);
 *   const message = await settings.getString(ctx, "system", "maintenanceMessage", "");
 *
 *   // Read or throw if missing (use sparingly)
 *   const apiKey = await settings.requireString(ctx, "integrations", "polarApiKey");
 *
 * WRITES:
 *   Writes go through `core/parameter/parameter.channel.ts` (admin-only).
 *   This module is read-only by design.
 *
 * REGISTERING NEW SETTINGS:
 *   Add to SETTINGS_REGISTRY below. The registry serves as documentation
 *   and is enforced by an architectural test (`tests/backend/settings.test.ts`).
 */
import type { QueryCtx } from "../_generated/server";
import { errors } from "./errors";

// ── Internal: direct parameter table reads ───────────────────────────────────
// We don't import from core/parameter because lib/ must be standalone.
// The parameters table is part of coreTables (registered via schema.ts).

async function readParameter(
  ctx: QueryCtx,
  scope: string,
  key: string,
) {
  return ctx.db
    .query("parameters")
    .withIndex("by_domain_key", (q: any) =>
      q.eq("domain", scope).eq("key", key),
    )
    .unique();
}

// ── Settings Registry ────────────────────────────────────────────────────────
//
// Every setting must be declared here. AI agents reading this file know
// exactly what settings exist, their type, scope, and default.
//
// Naming: scope = business domain or "system" for global

export const SETTINGS_REGISTRY = {
  system: {
    maintenanceMode: { type: "boolean", default: false, description: "Global maintenance mode flag" },
    maintenanceMessage: { type: "string", default: "", description: "Message shown during maintenance" },
    maxUploadSizeMb: { type: "number", default: 10, description: "Maximum file upload size in MB" },
    signupsEnabled: { type: "boolean", default: true, description: "Allow new user signups" },
  },
  feature: {
    // Feature flags — kebab-case names recommended for new flags
    waitlistMode: { type: "boolean", default: false, description: "Show waitlist instead of signup" },
  },
  rateLimit: {
    // Override built-in rate limiter dynamically (use with caution)
    overrideStrict: { type: "number", default: 0, description: "Override strict tier rate (0 = disabled)" },
  },
} as const;

export type SettingScope = keyof typeof SETTINGS_REGISTRY;

// ── Settings API ─────────────────────────────────────────────────────────────

export const settings = {
  /**
   * Read a number setting. Falls back to provided default or registry default.
   */
  async getNumber(
    ctx: QueryCtx,
    scope: SettingScope,
    key: string,
    fallback?: number,
  ): Promise<number> {
    const param = await readParameter(ctx, scope, key);
    if (param && typeof param.value === "number") return param.value;
    const registryDefault = getRegistryDefault(scope, key, "number");
    return fallback ?? (registryDefault as number) ?? 0;
  },

  /**
   * Read a boolean setting. Falls back to provided default or registry default.
   */
  async getBoolean(
    ctx: QueryCtx,
    scope: SettingScope,
    key: string,
    fallback?: boolean,
  ): Promise<boolean> {
    const param = await readParameter(ctx, scope, key);
    if (param && typeof param.value === "boolean") return param.value;
    const registryDefault = getRegistryDefault(scope, key, "boolean");
    return fallback ?? (registryDefault as boolean) ?? false;
  },

  /**
   * Read a string setting. Falls back to provided default or registry default.
   */
  async getString(
    ctx: QueryCtx,
    scope: SettingScope,
    key: string,
    fallback?: string,
  ): Promise<string> {
    const param = await readParameter(ctx, scope, key);
    if (param && typeof param.value === "string") return param.value;
    const registryDefault = getRegistryDefault(scope, key, "string");
    return fallback ?? (registryDefault as string) ?? "";
  },

  /**
   * Read any setting. Returns the raw stored value or null.
   */
  async getRaw(
    ctx: QueryCtx,
    scope: SettingScope,
    key: string,
  ): Promise<unknown> {
    const param = await readParameter(ctx, scope, key);
    return param?.value ?? null;
  },

  /**
   * Throws if the setting is not present in the database.
   * Use for required configuration like API keys.
   */
  async requireString(
    ctx: QueryCtx,
    scope: SettingScope,
    key: string,
  ): Promise<string> {
    const param = await readParameter(ctx, scope, key);
    if (!param || typeof param.value !== "string" || param.value === "") {
      throw errors.internal(`Missing required setting: ${scope}.${key}`);
    }
    return param.value;
  },

  /**
   * Returns the static registry — useful for admin UI dropdowns.
   */
  registry: SETTINGS_REGISTRY,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRegistryDefault(
  scope: SettingScope,
  key: string,
  expectedType: string,
): unknown {
  const scopeBlock = SETTINGS_REGISTRY[scope] as
    | Record<string, { type: string; default: unknown }>
    | undefined;
  if (!scopeBlock) return undefined;
  const entry = scopeBlock[key];
  if (!entry) return undefined;
  if (entry.type !== expectedType) return undefined;
  return entry.default;
}
