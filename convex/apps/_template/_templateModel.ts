// @ts-nocheck — Template scaffolding (not spread into schema.ts).
/**
 * _template model — pure DB read helpers.
 *
 * Rules:
 * - Function names: get*, list*, find*, exists*, count*
 * - Return null on miss, never throw
 * - No Convex builders (no internalMutation/Query)
 * - No business logic, no auth checks
 */
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function getItemById(
  ctx: QueryCtx,
  id: Id<"_templateItems">,
) {
  return ctx.db.get(id);
}

export async function listActiveItems(ctx: QueryCtx, limit = 50) {
  return ctx.db
    .query("_templateItems")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .order("desc")
    .take(limit);
}

export async function existsItemByName(
  ctx: QueryCtx,
  name: string,
): Promise<boolean> {
  const item = await ctx.db
    .query("_templateItems")
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();
  return item !== null;
}
