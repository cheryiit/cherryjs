import type { QueryCtx } from "../../_generated/server";

export async function getActiveSubscription(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

export async function getSubscriptionByPolarId(
  ctx: QueryCtx,
  polarId: string,
) {
  return ctx.db
    .query("subscriptions")
    .withIndex("by_polarId", (q) => q.eq("polarId", polarId))
    .first();
}

export async function getPaymentByUserId(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("payments")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

export async function getPaymentByPolarId(ctx: QueryCtx, polarId: string) {
  return ctx.db
    .query("payments")
    .withIndex("by_polarId", (q) => q.eq("polarId", polarId))
    .first();
}
