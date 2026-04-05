import {
  customQuery,
  customMutation,
  customAction,
} from "convex-helpers/server/customFunctions";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import { v } from "convex/values";
import { errors } from "./errors";
import { rateLimiter } from "./rate-limiter";
import { requestMetaValidator, type RequestMeta } from "./request-context";
import { buildAuditHelper, type AuditHelper } from "./audit";
import type { Doc, Id } from "../_generated/dataModel";

// ── User Resolver ─────────────────────────────────────────────────────────────

async function resolveCurrentUser(ctx: { auth: any; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_token", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique() as Promise<Doc<"users"> | null>;
}

// ── Tier 1: Public ────────────────────────────────────────────────────────────

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

// ── Tier 2: Authenticated (base — no rate limit) ─────────────────────────────
// Used ONLY as base for rate-limited wrappers. Never directly in channel files.

export const authenticatedQuery = customQuery(query, {
  args: {
    _requestMeta: requestMetaValidator,
  },
  input: async (ctx, { _requestMeta }) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");
    return {
      ctx: { ...ctx, user, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: {
    _requestMeta: requestMetaValidator,
  },
  input: async (ctx, { _requestMeta }) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");
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

// ── Tier 3: Admin (base — no rate limit) ──────────────────────────────────────
// Used ONLY as base for adminRateLimitedMutation. Never directly in channel.

export const adminQuery = customQuery(authenticatedQuery, {
  args: {},
  input: async (ctx) => {
    if (ctx.user.role !== "admin") throw errors.forbidden("Admin access required");
    return { ctx, args: {} };
  },
});

export const adminMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    if (ctx.user.role !== "admin") throw errors.forbidden("Admin access required");
    return { ctx, args: {} };
  },
});

// ── Tier 4: Rate-Limited Wrappers (MANDATORY for channel files) ───────────────

/** STRICT: 5/min — payment, order, account deletion */
export const strictMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "strict", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/** NORMAL: 30/min — standard CRUD */
export const normalMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "normal", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/** RELAXED: 100/min — low-risk updates */
export const relaxedMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "relaxed", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/** BURST: token bucket — bulk import, batch operations */
export const burstMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "burst", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/** ADMIN RATE LIMITED: 200/min — admin panel operations */
export const adminRateLimitedMutation = customMutation(adminMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "admin-ops", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/** PUBLIC STRICT: No auth, IP-based rate limit — signup, login */
export const publicStrictMutation = customMutation(publicMutation, {
  args: {
    _requestMeta: requestMetaValidator,
  },
  input: async (ctx, { _requestMeta }) => {
    const key = _requestMeta?.userAgent ?? "anonymous";
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "auth-ops", {
      key,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return {
      ctx: { ...ctx, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});

// ── Tier 5: Maintenance-Aware ─────────────────────────────────────────────────

export const activeSystemMutation = customMutation(normalMutation, {
  args: {},
  input: async (ctx) => {
    const maintenanceMode = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q: any) =>
        q.eq("domain", undefined).eq("key", "maintenance-mode"),
      )
      .first();

    if (maintenanceMode?.value === true) {
      throw errors.maintenance();
    }
    return { ctx, args: {} };
  },
});

// ── Tier 6: Verified User ────────────────────────────────────────────────────

export const verifiedUserMutation = customMutation(normalMutation, {
  args: {},
  input: async (ctx) => {
    if (!ctx.user.emailVerified) {
      throw errors.forbidden("Email verification required");
    }
    return { ctx, args: {} };
  },
});

// ── Internal ──────────────────────────────────────────────────────────────────

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
