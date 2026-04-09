// @ts-nocheck — Convex issue #53: TS2589 (see lib/functions.ts).
/**
 * _template business — internal mutations and queries.
 *
 * Rules:
 * - Use businessMutation/Query from lib/functions (NOT raw internalMutation)
 * - Only export internal functions (never public API here)
 * - All business logic lives here
 * - Import model helpers for reads
 */
import { v } from "convex/values";
import { businessMutation, businessQuery } from "../../lib/functions";
import { errors } from "../../lib/errors";
import { getItemById, listActiveItems } from "./_templateModel";

export const list = businessQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return listActiveItems(ctx, limit);
  },
});

export const create = businessMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return ctx.db.insert("_templateItems", {
      name,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const archive = businessMutation({
  args: { id: v.id("_templateItems") },
  handler: async (ctx, { id }) => {
    const item = await getItemById(ctx, id);
    if (!item) throw errors.notFound("Item", id);
    await ctx.db.patch(id, { status: "archived" });
  },
});
