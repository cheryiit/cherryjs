// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
/**
 * Content Model — Pure DB Read Helpers
 *
 * The content system stores page-level text/markdown content
 * (terms, privacy, FAQ, marketing copy, etc.) that needs to be
 * editable without a deploy. Read by anyone, written by admin only.
 */
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function getContentBySlug(
  ctx: QueryCtx,
  slug: string,
  locale = "en",
) {
  return ctx.db
    .query("contents")
    .withIndex("by_slug_locale", (q) =>
      q.eq("slug", slug).eq("locale", locale),
    )
    .unique();
}

export async function getContentById(ctx: QueryCtx, id: Id<"contents">) {
  return ctx.db.get(id);
}

export async function listPublishedContents(
  ctx: QueryCtx,
  locale = "en",
) {
  return ctx.db
    .query("contents")
    .withIndex("by_status_locale", (q) =>
      q.eq("status", "published").eq("locale", locale),
    )
    .collect();
}

export async function listAllContents(ctx: QueryCtx) {
  return ctx.db.query("contents").collect();
}

export async function findContentsByTag(ctx: QueryCtx, tag: string) {
  return ctx.db
    .query("contents")
    .filter((q) => q.eq(q.field("tag"), tag))
    .collect();
}

export async function existsContentSlug(
  ctx: QueryCtx,
  slug: string,
  locale: string,
): Promise<boolean> {
  const existing = await getContentBySlug(ctx, slug, locale);
  return existing !== null;
}