// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
/**
 * Content Channel Layer
 *
 * Public read access for any visitor; admin-only writes with audit logging.
 *
 * Read endpoints:
 *   - getPublished: public, returns null if not published
 *   - listPublished: public, returns all published content for a locale
 *
 * Write endpoints (admin):
 *   - upsert: create or update content
 *   - setStatus: change publication status
 *   - remove: hard delete (use with caution — prefer setStatus archived)
 */
import { v } from "convex/values";
import {
  publicQuery,
  adminQuery,
  adminRateLimitedMutation,
} from "../../lib/functions";
import { internal } from "../../_generated/api";

const contentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

// ── Public Reads ─────────────────────────────────────────────────────────────

export const getPublished = publicQuery({
  args: {
    slug: v.string(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { slug, locale }) => {
    const content = await ctx.runQuery(
      internal.core.content.contentBusiness.getBySlug,
      { slug, locale },
    );
    if (!content || content.status !== "published") return null;
    return content;
  },
});

export const listPublished = publicQuery({
  args: { locale: v.optional(v.string()) },
  handler: async (ctx, { locale }) => {
    return ctx.runQuery(
      internal.core.content.contentBusiness.listPublished,
      { locale },
    );
  },
});

// ── Admin Reads ──────────────────────────────────────────────────────────────

/** @admin */
export const adminListAll = adminQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(internal.core.content.contentBusiness.listAll, {});
  },
});

/** @admin */
export const adminGetById = adminQuery({
  args: { id: v.id("contents") },
  handler: async (ctx, { id }) => {
    return ctx.runQuery(internal.core.content.contentBusiness.getById, {
      id,
    });
  },
});

// ── Admin Writes ─────────────────────────────────────────────────────────────

/** @admin */
export const upsert = adminRateLimitedMutation({
  args: {
    slug: v.string(),
    locale: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    tag: v.optional(v.string()),
    status: v.optional(contentStatusValidator),
  },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(
      internal.core.content.contentBusiness.upsert,
      { ...args, updatedBy: ctx.user._id },
    );

    await ctx.audit.log({
      action: "content.upsert",
      resourceType: "content",
      resourceId: args.slug,
      details: { locale: args.locale ?? "en", status: args.status ?? "draft" },
    });

    return id;
  },
});

/** @admin */
export const setStatus = adminRateLimitedMutation({
  args: {
    id: v.id("contents"),
    status: contentStatusValidator,
  },
  handler: async (ctx, { id, status }) => {
    await ctx.runMutation(
      internal.core.content.contentBusiness.setStatus,
      { id, status, updatedBy: ctx.user._id },
    );

    await ctx.audit.log({
      action: "content.setStatus",
      resourceType: "content",
      resourceId: id,
      details: { status },
    });
  },
});

/** @admin @critical */
export const remove = adminRateLimitedMutation({
  args: { id: v.id("contents") },
  handler: async (ctx, { id }) => {
    await ctx.runMutation(internal.core.content.contentBusiness.remove, {
      id,
    });

    await ctx.audit.warn({
      action: "content.delete",
      resourceType: "content",
      resourceId: id,
    });
  },
});