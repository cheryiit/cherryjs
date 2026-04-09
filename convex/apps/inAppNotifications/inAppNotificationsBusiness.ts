// @ts-nocheck — Convex issue #53: TS2589 on large schemas (see lib/functions.ts).
//
// In-app notifications — business logic.
//
// Most heavy lifting (auth, rate limiting) happens in the channel layer.
// This file contains pure mutations and queries that operate on the
// notification table directly. Cross-domain code should NOT touch
// `inAppNotifications` directly — call these via `runMutation`/`runQuery`.
import { v } from "convex/values";
import { businessMutation, businessQuery } from "../../lib/functions";
import {
  listUnreadNotifications,
  listNotificationsForUser,
  countUnreadNotifications,
  getNotificationById,
} from "./inAppNotificationsModel";

const typeValidator = v.union(
  v.literal("info"),
  v.literal("success"),
  v.literal("warning"),
  v.literal("critical"),
);

const channelValidator = v.union(
  v.literal("in-app"),
  v.literal("email"),
  v.literal("push"),
);

// ── Reads ────────────────────────────────────────────────────────────────────

export const listUnreadForUser = businessQuery({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return listUnreadNotifications(ctx, userId, limit);
  },
});

export const listFeedForUser = businessQuery({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return listNotificationsForUser(ctx, userId, limit);
  },
});

export const countUnreadForUser = businessQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return countUnreadNotifications(ctx, userId);
  },
});

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Create a notification for a user. The row is inserted as
 * `delivered` immediately so it shows up in the bell drawer on the next
 * Convex websocket tick (any subscribed `useQuery` re-runs).
 *
 * If `channels` includes "email" or "push", call this from a workflow
 * step that follows up with the corresponding outbound delivery action.
 */
export const createNotification = businessMutation({
  args: {
    userId: v.id("users"),
    type: typeValidator,
    category: v.string(),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    channels: v.optional(v.array(channelValidator)),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("inAppNotifications", {
      ...args,
      channels: args.channels ?? ["in-app"],
      status: "delivered",
      deliveredAt: now,
      createdAt: now,
    });
  },
});

/** Mark a single notification as read. No-op if already read or dismissed. */
export const markRead = businessMutation({
  args: { notificationId: v.id("inAppNotifications") },
  handler: async (ctx, { notificationId }) => {
    const notif = await getNotificationById(ctx, notificationId);
    if (!notif) return;
    if (notif.status === "read" || notif.status === "dismissed") return;
    await ctx.db.patch(notificationId, {
      status: "read",
      readAt: Date.now(),
    });
  },
});

/** Bulk mark all of a user's delivered notifications as read. */
export const markAllReadForUser = businessMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const unread = await listUnreadNotifications(ctx, userId, 200);
    const now = Date.now();
    for (const notif of unread) {
      await ctx.db.patch(notif._id, { status: "read", readAt: now });
    }
    return { count: unread.length };
  },
});

export const dismiss = businessMutation({
  args: { notificationId: v.id("inAppNotifications") },
  handler: async (ctx, { notificationId }) => {
    const notif = await getNotificationById(ctx, notificationId);
    if (!notif) return;
    await ctx.db.patch(notificationId, {
      status: "dismissed",
      dismissedAt: Date.now(),
    });
  },
});

/**
 * Internal: attach an external delivery message id (Resend message id,
 * FCM receipt id, etc.) once the outbound channel completes. Called from
 * the integration/workflow step that handles fan-out.
 */
export const recordExternalDelivery = businessMutation({
  args: {
    notificationId: v.id("inAppNotifications"),
    emailMessageId: v.optional(v.string()),
    pushReceiptId: v.optional(v.string()),
  },
  handler: async (ctx, { notificationId, emailMessageId, pushReceiptId }) => {
    const patch: Record<string, unknown> = {};
    if (emailMessageId) patch.emailMessageId = emailMessageId;
    if (pushReceiptId) patch.pushReceiptId = pushReceiptId;
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(notificationId, patch);
  },
});

/**
 * Cleanup: delete notifications where `expiresAt` is in the past.
 * Intended to be called from a daily cron via `core/schedule/`.
 */
export const cleanupExpired = businessMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 200 }) => {
    const now = Date.now();
    // cherry:allow
    const expired = await ctx.db
      .query("inAppNotifications")
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), undefined),
          q.lt(q.field("expiresAt"), now),
        ),
      )
      .take(batchSize);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    return { deleted: expired.length, hasMore: expired.length === batchSize };
  },
});
