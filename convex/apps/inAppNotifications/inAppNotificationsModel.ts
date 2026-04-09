/**
 * In-app notifications — pure DB read helpers.
 *
 * Model layer: no Convex builders, no business logic, no exceptions.
 * Returns null/empty arrays on miss. Used by the business and channel
 * layers via direct function call.
 */
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function getNotificationById(
  ctx: QueryCtx,
  id: Id<"inAppNotifications">,
) {
  return ctx.db.get(id);
}

/**
 * List a user's unread (status === "delivered") notifications, newest
 * first. Default page size 50.
 */
export async function listUnreadNotifications(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit = 50,
) {
  return ctx.db
    .query("inAppNotifications")
    .withIndex("by_user_unread", (q) =>
      q.eq("userId", userId).eq("status", "delivered"),
    )
    .order("desc")
    .take(limit);
}

/** Full feed (any status), newest first. */
export async function listNotificationsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit = 50,
) {
  return ctx.db
    .query("inAppNotifications")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);
}

/**
 * Count of unread notifications for the bell-icon badge.
 *
 * Bounded with `.take(UNREAD_COUNT_CAP)` because the badge only ever
 * needs to render "N" or "99+". A user with more unread than the cap
 * sees the cap value, which is correct UX. For exact counts on huge
 * datasets, swap this for an aggregate component instance.
 */
const UNREAD_COUNT_CAP = 100;

export async function countUnreadNotifications(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("inAppNotifications")
    .withIndex("by_user_unread", (q) =>
      q.eq("userId", userId).eq("status", "delivered"),
    )
    .take(UNREAD_COUNT_CAP);
  return rows.length;
}

/** Find the latest notification of a given category for a user. */
export async function findLatestByCategory(
  ctx: QueryCtx,
  userId: Id<"users">,
  category: string,
) {
  return ctx.db
    .query("inAppNotifications")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .filter((q) => q.eq(q.field("category"), category))
    .first();
}
