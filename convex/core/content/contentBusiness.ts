// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
/**
 * Content Business Layer
 *
 * Internal mutations and queries for the content system.
 * All public API access goes through content.channel.ts wrappers.
 */
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getContentBySlug,
  getContentById,
  listPublishedContents,
  listAllContents,
} from "./contentModel";

const contentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

// ── Reads ────────────────────────────────────────────────────────────────────

export const getBySlug = businessQuery({
  args: {
    slug: v.string(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { slug, locale }) => {
    return getContentBySlug(ctx, slug, locale ?? "en");
  },
});

export const getById = businessQuery({
  args: { id: v.id("contents") },
  handler: async (ctx, { id }) => {
    return getContentById(ctx, id);
  },
});

export const listPublished = businessQuery({
  args: { locale: v.optional(v.string()) },
  handler: async (ctx, { locale }) => {
    return listPublishedContents(ctx, locale ?? "en");
  },
});

export const listAll = businessQuery({
  args: {},
  handler: async (ctx) => {
    return listAllContents(ctx);
  },
});

// ── Writes ───────────────────────────────────────────────────────────────────

export const upsert = businessMutation({
  args: {
    slug: v.string(),
    locale: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    tag: v.optional(v.string()),
    status: v.optional(contentStatusValidator),
    updatedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const locale = args.locale ?? "en";
    const status = args.status ?? "draft";
    const existing = await getContentBySlug(ctx, args.slug, locale);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        body: args.body,
        tag: args.tag,
        status,
        updatedBy: args.updatedBy,
        updatedAt: now,
        publishedAt:
          status === "published" && existing.status !== "published"
            ? now
            : existing.publishedAt,
      });
      return existing._id;
    }

    return ctx.db.insert("contents", {
      slug: args.slug,
      locale,
      title: args.title,
      body: args.body,
      tag: args.tag,
      status,
      updatedBy: args.updatedBy,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "published" ? now : undefined,
    });
  },
});

export const setStatus = businessMutation({
  args: {
    id: v.id("contents"),
    status: contentStatusValidator,
    updatedBy: v.id("users"),
  },
  handler: async (ctx, { id, status, updatedBy }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw errors.notFound("Content", id);

    const now = Date.now();
    await ctx.db.patch(id, {
      status,
      updatedBy,
      updatedAt: now,
      publishedAt:
        status === "published" && existing.status !== "published"
          ? now
          : existing.publishedAt,
    });
  },
});

export const remove = businessMutation({
  args: { id: v.id("contents") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw errors.notFound("Content", id);
    await ctx.db.delete(id);
  },
});