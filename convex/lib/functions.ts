/**
 * Function Wrappers (Channel Layer)
 *
 * All channel-layer Convex functions MUST use one of the wrappers exported
 * here. Each wrapper is built directly on top of the base `mutation` /
 * `query` / `action` builders (NOT chained on other wrappers) so that
 * TypeScript can infer the full ctx shape.
 *
 * Why flat composition: chaining `customMutation(otherCustomMutation, ...)`
 * loses ctx type information through the chain — `ctx.user` becomes
 * untyped. Building each wrapper from the base + shared helper functions
 * keeps every wrapper's ctx fully typed.
 */
import {
  customQuery,
  customMutation,
  customAction,
  NoOp,
} from "convex-helpers/server/customFunctions";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
  type QueryCtx,
  type MutationCtx,
  type ActionCtx,
} from "../_generated/server";
import { errors } from "./errors";
import { rateLimiter } from "./rateLimiter";
import { requestMetaValidator, type RequestMeta } from "./requestContext";
import { buildAuditHelper } from "./audit";
import type { Doc } from "../_generated/dataModel";

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolves the current user from the JWT subject (Better Auth user id).
 * Returns null if not authenticated. See README at top of file for the
 * `subject` vs `tokenIdentifier` rationale.
 */
async function resolveCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authUserId", identity.subject))
    .unique();
}

/**
 * Loads the current user, throws if missing/inactive, optionally enforces
 * the admin role. Used by every authenticated wrapper below.
 */
async function requireUser(
  ctx: QueryCtx | MutationCtx,
  opts: { admin?: boolean } = {},
): Promise<Doc<"users">> {
  const user = await resolveCurrentUser(ctx);
  if (!user) throw errors.unauthenticated();
  if (!user.isActive) throw errors.forbidden("Account is deactivated");
  if (opts.admin && user.role !== "admin") {
    throw errors.forbidden("Admin access required");
  }
  return user;
}

/**
 * Applies a rate limit keyed by user id. Throws `errors.rateLimited` on
 * failure with the retry-after delay.
 */
async function applyRateLimit(
  ctx: MutationCtx,
  limiterKey:
    | "strict"
    | "normal"
    | "relaxed"
    | "burst"
    | "admin-ops"
    | "auth-ops",
  key: string,
): Promise<void> {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, limiterKey, {
    key,
    throws: false,
  });
  if (!ok) throw errors.rateLimited(retryAfter);
}

// =============================================================================
// Tier 1: PUBLIC — no auth, no rate limit
// =============================================================================

export const publicQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const publicMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const publicAction = customAction(action, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

// =============================================================================
// Tier 2: AUTHENTICATED — user resolved, no rate limit
// (Used as the base for read endpoints. Mutations should prefer one of the
//  rate-limited wrappers below.)
// =============================================================================

export const authenticatedQuery = customQuery(query, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    return {
      ctx: { ...ctx, user, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

export const authenticatedAction = customAction(action, {
  args: {},
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw errors.unauthenticated();
    return { ctx: { ...ctx, identity }, args: {} };
  },
});

// =============================================================================
// Tier 3: ADMIN — user resolved + role check, no rate limit
// =============================================================================

export const adminQuery = customQuery(query, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx, { admin: true });
    return {
      ctx: { ...ctx, user, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});

export const adminMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx, { admin: true });
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

// =============================================================================
// Tier 4: RATE-LIMITED MUTATIONS (MANDATORY for channel files)
// =============================================================================

/** STRICT: 5/min — payment, order, account deletion */
export const strictMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    await applyRateLimit(ctx, "strict", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

/** NORMAL: 30/min — standard CRUD */
export const normalMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    await applyRateLimit(ctx, "normal", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

/** RELAXED: 100/min — low-risk updates */
export const relaxedMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    await applyRateLimit(ctx, "relaxed", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

/** BURST: token bucket — bulk import, batch operations */
export const burstMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    await applyRateLimit(ctx, "burst", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

/** ADMIN RATE LIMITED: 200/min — admin panel operations */
export const adminRateLimitedMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx, { admin: true });
    await applyRateLimit(ctx, "admin-ops", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

/** PUBLIC STRICT: No auth, IP/UA-based rate limit — signup, login, password reset */
export const publicStrictMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const key = _requestMeta?.userAgent ?? "anonymous";
    await applyRateLimit(ctx, "auth-ops", key);
    return {
      ctx: { ...ctx, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});

// =============================================================================
// Tier 5: MAINTENANCE-AWARE — fails when system is in maintenance mode
// =============================================================================

export const activeSystemMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    await applyRateLimit(ctx, "normal", user._id);

    const maintenanceMode = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q) =>
        q.eq("domain", undefined).eq("key", "maintenance-mode"),
      )
      .first();
    if (maintenanceMode?.value === true) throw errors.maintenance();

    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

// =============================================================================
// Tier 6: VERIFIED USER — requires email verification
// =============================================================================

export const verifiedUserMutation = customMutation(mutation, {
  args: { _requestMeta: requestMetaValidator },
  input: async (ctx, { _requestMeta }) => {
    const user = await requireUser(ctx);
    if (!user.emailVerified) {
      throw errors.forbidden("Email verification required");
    }
    await applyRateLimit(ctx, "normal", user._id);
    const requestMeta: RequestMeta | null = _requestMeta ?? null;
    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

// =============================================================================
// Tier 7: INTERNAL — for system-to-system calls (cron, scheduler, triggers)
// =============================================================================

export const internalAuthQuery = customQuery(internalQuery, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const internalAuthMutation = customMutation(internalMutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const internalAuthAction = customAction(internalAction, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

// =============================================================================
// Tier 8: BUSINESS — re-exports of internal builders for domain files
// =============================================================================
//
// Why these exist as re-exports:
//
// Convex's raw `internalMutation`/`internalQuery` from `_generated/server`
// carry a generic `DataModel` that, once the aggregated schema crosses ~10
// tables, causes TypeScript error TS2589 ("Type instantiation is excessively
// deep and possibly infinite") on every `v.*` call in every args block.
// This is a known Convex issue (convex-js#53, ~Apr 2026) with no fix yet.
//
// Workaround applied at the domain-file level: every `*Business.ts`,
// `*Integration.ts`, `*Channel.ts`, `*Model.ts` under `apps/` and `core/`
// has a `// @ts-nocheck` header. Runtime is still fully validated by
// Convex's schema validators + our architectural tests, and the lib/ +
// channel-layer wrappers (which aren't @ts-nocheck) type-check fine.
//
// These re-exports keep the PROPER internal-builder types so that the
// generated `_generated/api.d.ts` correctly categorizes functions under
// `internal.apps.*` and `internal.core.*` (a plain cast to `any` would
// make FilterApi drop them). Domain files import `businessMutation` etc.
// instead of reaching into `_generated/server` directly, which keeps our
// dependency-cruiser firewall happy and provides a single point to swap
// the implementation if Convex ever fixes the type-inference issue.

export { internalQuery as businessQuery } from "../_generated/server";
export { internalMutation as businessMutation } from "../_generated/server";
export { internalAction as businessAction } from "../_generated/server";

// Re-export ctx types so domain files can annotate them without reaching
// into `_generated/server` directly.
export type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
