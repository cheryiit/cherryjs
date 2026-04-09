import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * In-app notifications — site-içi (bell icon, notification feed) bildirimler.
 *
 * NOT to be confused with `apps/notifications/` which handles outbound
 * EMAILS via Resend. This domain owns notifications that live INSIDE the
 * application (and optionally fan out to email/push as additional
 * delivery channels).
 *
 * Why a dedicated table:
 * - Convex's reactive queries make `useQuery(api.inAppNotifications.listMyUnread)`
 *   automatically push new rows to the bell icon over websocket — no
 *   custom push infrastructure required.
 * - Status lifecycle (pending → delivered → read → dismissed) gives
 *   delivery tracking out of the box.
 * - Multi-channel fan-out: same row, `channels: ["in-app", "email"]`
 *   triggers parallel email/push delivery while keeping one source of
 *   truth.
 *
 * Indexes optimized for the two hot reads:
 *   1. `by_user_unread`: bell-icon listing ("show me my unread notifications")
 *   2. `by_user_created`: full feed pagination
 */

export const inAppNotificationFields = {
  /** Recipient (app user, not Better Auth user). */
  userId: v.id("users"),

  /**
   * Coarse severity bucket. Drives bell-icon color and toast variant on
   * the frontend.
   */
  type: v.union(
    v.literal("info"),
    v.literal("success"),
    v.literal("warning"),
    v.literal("critical"),
  ),

  /**
   * Domain category, dot.separated. Used for grouping, filtering, and
   * routing the click handler.
   *
   * Examples:
   *   "user.mentioned"
   *   "payment.succeeded"
   *   "payment.failed"
   *   "system.maintenance"
   *   "team.invited"
   */
  category: v.string(),

  /** Short headline shown in the bell drawer. */
  title: v.string(),
  /** Body text — markdown OK, kept short for UI. */
  body: v.string(),

  /** Where the notification links to when clicked. */
  actionUrl: v.optional(v.string()),

  /** Free-form context payload (orderId, mentionedBy, etc.). */
  metadata: v.optional(v.any()),

  // ── Delivery tracking ──────────────────────────────────────────────────
  status: v.union(
    v.literal("pending"),     // queued, not yet visible
    v.literal("delivered"),   // visible in bell drawer
    v.literal("read"),        // user opened the drawer / clicked
    v.literal("dismissed"),   // user explicitly hid it
  ),
  deliveredAt: v.optional(v.number()),
  readAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),

  // ── Multi-channel fan-out (optional) ───────────────────────────────────
  /**
   * Additional delivery channels to fan out to alongside the in-app
   * notification. The in-app row is always created; the other channels
   * are best-effort and tracked via the *MessageId fields.
   */
  channels: v.optional(
    v.array(
      v.union(
        v.literal("in-app"),
        v.literal("email"),
        v.literal("push"),
      ),
    ),
  ),
  emailMessageId: v.optional(v.string()),
  pushReceiptId: v.optional(v.string()),

  /**
   * Auto-cleanup hint. If set, a cron may delete this row after the
   * timestamp passes. Useful for ephemeral system notifications.
   */
  expiresAt: v.optional(v.number()),

  createdAt: v.number(),
};

export const inAppNotificationsTables = {
  inAppNotifications: defineTable(inAppNotificationFields)
    .index("by_user_unread", ["userId", "status", "createdAt"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_category", ["category", "createdAt"]),
};
