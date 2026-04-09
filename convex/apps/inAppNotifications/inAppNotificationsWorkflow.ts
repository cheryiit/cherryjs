// @ts-nocheck — Convex issue #53: TS2589 on large schemas (see lib/functions.ts).
//
// In-app notifications — fan-out orchestration via @convex-dev/workflow.
//
// Why a workflow instead of inline mutation+action calls:
//
//   1. **Durability** — if the email step fails (Resend down, network
//      blip), the workflow retries automatically with backoff. The
//      in-app row is already inserted so the user sees the notification
//      even when email is delayed.
//   2. **Atomicity boundary** — each step is its own transaction. The
//      in-app insert commits before the action steps run, so the bell
//      icon updates over websocket immediately.
//   3. **Observability** — every step is recorded in the workflow
//      component's history, queryable via `workflow.list(workflowId)`
//      for debugging delivery failures.
//   4. **Multi-channel reuse** — the same workflow handles "in-app
//      only", "in-app + email", "in-app + push", etc. Future channels
//      add a step here and don't touch caller code.
//
// EXECUTION CONTRACT
//
//   sendNotification → kicks off `notificationFanout` workflow
//      ↓
//   Step 1: insert in-app row (mutation, inline) → returns notificationId
//      ↓                                          ↓ user sees bell badge
//   Step 2 (if email channel): lookup user email (query, inline)
//      ↓
//   Step 3 (if email channel): send email via Resend (action, retry on fail)
//      ↓
//   Step 4 (if email channel): patch notification with email message id
//
// Push and SMS channels follow the same pattern: lookup destination →
// integration action → patch row.
import { v } from "convex/values";
import { workflow } from "../../lib/workflow";
import { internal } from "../../_generated/api";

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

/**
 * Multi-channel notification delivery workflow.
 *
 * Always inserts the in-app row first (channel "in-app" is implicit).
 * Then fans out to whichever extra channels are requested.
 *
 * Args:
 *   userId       — recipient app user
 *   type         — severity bucket
 *   category     — dot.separated event category
 *   title, body  — notification content
 *   actionUrl?   — optional click target
 *   metadata?    — free-form context
 *   channels?    — extra delivery channels (default: in-app only)
 *   emailSubject? — email subject line override (defaults to title)
 */
export const notificationFanout = workflow.define({
  args: {
    userId: v.id("users"),
    type: typeValidator,
    category: v.string(),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    channels: v.optional(v.array(channelValidator)),
    emailSubject: v.optional(v.string()),
  },
  handler: async (step, args) => {
    const channels = args.channels ?? ["in-app"];

    // ── Step 1: insert in-app row (always) ──────────────────────────────
    const notificationId = await step.runMutation(
      internal.apps.inAppNotifications.inAppNotificationsBusiness
        .createNotification,
      {
        userId: args.userId,
        type: args.type,
        category: args.category,
        title: args.title,
        body: args.body,
        actionUrl: args.actionUrl,
        metadata: args.metadata,
        channels,
      },
      { inline: true },
    );

    // ── Step 2 (email channel only): lookup recipient email ─────────────
    if (channels.includes("email")) {
      const user = await step.runQuery(
        internal.apps.users.usersBusiness.getUser,
        { userId: args.userId },
        { inline: true },
      );
      if (user?.email) {
        // Step 3: outbound send via Resend (action, retried automatically)
        const messageId = await step.runAction(
          internal.apps.inAppNotifications.inAppNotificationsIntegration
            .sendEmailNotification,
          {
            toEmail: user.email,
            subject: args.emailSubject ?? args.title,
            title: args.title,
            body: args.body,
            actionUrl: args.actionUrl,
          },
          { retry: true },
        );

        // Step 4: persist external delivery ref
        await step.runMutation(
          internal.apps.inAppNotifications.inAppNotificationsBusiness
            .recordExternalDelivery,
          { notificationId, emailMessageId: messageId },
          { inline: true },
        );
      }
    }

    // ── Future channels (push, sms) ─────────────────────────────────────
    // Add an `if (channels.includes("push"))` block here that calls a
    // pushIntegration action and patches `pushReceiptId` back. The same
    // workflow can fan out to N channels in parallel; the durability
    // guarantees apply equally.

    return { notificationId };
  },
});
