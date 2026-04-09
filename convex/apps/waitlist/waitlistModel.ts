import type { QueryCtx } from "../../_generated/server";

export async function getWaitlistEntryByEmail(ctx: QueryCtx, email: string) {
  return ctx.db
    .query("waitlistEntries")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

export async function listWaitlistEntriesByStatus(
  ctx: QueryCtx,
  status: "pending" | "approved" | "rejected",
) {
  return ctx.db
    .query("waitlistEntries")
    .withIndex("by_status", (q) => q.eq("status", status))
    .order("desc")
    .collect();
}

export async function countPendingBefore(ctx: QueryCtx, createdAt: number) {
  const entries = await ctx.db
    .query("waitlistEntries")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .filter((q) => q.lt(q.field("createdAt"), createdAt))
    .collect();
  return entries.length;
}
