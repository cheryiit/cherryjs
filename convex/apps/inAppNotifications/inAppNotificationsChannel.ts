// @ts-nocheck — Convex issue #53: TS2589 (see lib/functions.ts).
// In-app notifications channel: reads (listMyUnread, listMyFeed,
// getMyUnreadCount), writes (markRead, markAllRead, dismiss), admin
// (adminBroadcast, sendNotification — kick the fan-out workflow).
import { v } from "convex/values";
import {
  authenticatedQuery,
  normalMutation,
  adminRateLimitedMutation,
} from "../../lib/functions";
import { workflow } from "../../lib/workflow";
import { internal } from "../../_generated/api";

// ── Reads ────────────────────────────────────────────────────────────────────

export const listMyUnread = authenticatedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.inAppNotifications.inAppNotificationsBusiness
        .listUnreadForUser,
      { userId: ctx.user._id, limit },
    );
  },
});

export const listMyFeed = authenticatedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.inAppNotifications.inAppNotificationsBusiness
        .listFeedForUser,
      { userId: ctx.user._id, limit },
    );
  },
});

export const getMyUnreadCount = authenticatedQuery({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.inAppNotifications.inAppNotificationsBusiness
        .countUnreadForUser,
      { userId: ctx.user._id },
    );
  },
});

// ── Writes ───────────────────────────────────────────────────────────────────

export const markRead = normalMutation({
  args: { notificationId: v.id("inAppNotifications") },
  handler: async (ctx, { notificationId }): Promise<void> => {
    await ctx.runMutation(
      internal.apps.inAppNotifications.inAppNotificationsBusiness.markRead,
      { notificationId },
    );
  },
});

export const markAllRead = normalMutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return ctx.runMutation(
      internal.apps.inAppNotifications.inAppNotificationsBusiness
        .markAllReadForUser,
      { userId: ctx.user._id },
    );
  },
});

export const dismiss = normalMutation({
  args: { notificationId: v.id("inAppNotifications") },
  handler: async (ctx, { notificationId }): Promise<void> => {
    await ctx.runMutation(
      internal.apps.inAppNotifications.inAppNotificationsBusiness.dismiss,
      { notificationId },
    );
  },
});

// ── Admin ────────────────────────────────────────────────────────────────────

/** @admin */
export const adminBroadcast = adminRateLimitedMutation({
  args: {
    userIds: v.array(v.id("users")),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    category: v.string(),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    channels: v.optional(
      v.array(
        v.union(v.literal("in-app"), v.literal("email"), v.literal("push")),
      ),
    ),
  },
  handler: async (
    ctx,
    { userIds, type, category, title, body, actionUrl, channels },
  ): Promise<{ count: number }> => {
    // Kick off the fan-out workflow per recipient. The workflow handles
    // in-app insert, email/push delivery, and external delivery tracking.
    for (const userId of userIds) {
      await workflow.start(
        ctx,
        internal.apps.inAppNotifications.inAppNotificationsWorkflow
          .notificationFanout,
        {
          userId,
          type,
          category,
          title,
          body,
          actionUrl,
          channels: channels ?? ["in-app"],
        },
      );
    }

    await ctx.audit.warn({
      action: "inAppNotifications.broadcast",
      resourceType: "inAppNotification",
      details: {
        count: userIds.length,
        category,
        title,
        channels: channels ?? ["in-app"],
      },
    });

    return { count: userIds.length };
  },
});

/**
 * @admin
 *
 * Send a single notification with full multi-channel fan-out. Use this
 * from internal triggers (post-payment success, password reset, etc.)
 * or from admin tooling for one-off announcements. For mass broadcasts,
 * prefer `adminBroadcast` which loops over recipients.
 */
export const sendNotification = adminRateLimitedMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    category: v.string(),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    channels: v.optional(
      v.array(
        v.union(v.literal("in-app"), v.literal("email"), v.literal("push")),
      ),
    ),
    emailSubject: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await workflow.start(
      ctx,
      internal.apps.inAppNotifications.inAppNotificationsWorkflow
        .notificationFanout,
      args,
    );

    await ctx.audit.log({
      action: "inAppNotifications.send",
      resourceType: "inAppNotification",
      resourceId: args.userId,
      details: {
        category: args.category,
        title: args.title,
        channels: args.channels ?? ["in-app"],
      },
    });
  },
});
