// @ts-nocheck — Convex issue #53: TS2589 (see lib/functions.ts).
/**
 * _template channel — public API surface.
 *
 * Rules:
 * - Every mutation MUST use a rate-limited wrapper
 * - Max 200 lines, handler max 20 lines
 * - Delegate to business via ctx.runMutation/runQuery
 * - Admin endpoints: /** @admin *​/ marker + adminRateLimitedMutation + ctx.audit
 */
import { v } from "convex/values";
import {
  publicQuery,
  normalMutation,
  adminRateLimitedMutation,
} from "../../lib/functions";
import { internal } from "../../_generated/api";

// ── Public reads ─────────────────────────────────────────────────────────────

export const list = publicQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps._template._templateBusiness.list,
      { limit },
    );
  },
});

// ── Authenticated writes ─────────────────────────────────────────────────────

export const create = normalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<unknown> => {
    return ctx.runMutation(
      internal.apps._template._templateBusiness.create,
      { name },
    );
  },
});

// ── Admin ────────────────────────────────────────────────────────────────────

/** @admin */
export const archive = adminRateLimitedMutation({
  args: { id: v.id("_templateItems") },
  handler: async (ctx, { id }): Promise<void> => {
    await ctx.runMutation(
      internal.apps._template._templateBusiness.archive,
      { id },
    );
    await ctx.audit.log({
      action: "_template.archive",
      resourceType: "_templateItem",
      resourceId: id,
    });
  },
});
