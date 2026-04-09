// @ts-nocheck — Convex issue #53: TS2589 on large schemas (see lib/functions.ts).
//
// In-app notifications — outbound integration layer.
//
// External I/O for the notification fan-out workflow:
//
//   sendEmailNotification — call Resend (via @convex-dev/resend) to
//     deliver an email copy of an in-app notification. Returns the Resend
//     message id so the workflow can persist it back onto the
//     notification row for delivery tracking.
//
// Future channels (push, sms, slack) get their own actions here. The
// workflow in `inAppNotificationsWorkflow.ts` is the single coordinator
// that calls them.
//
// Pattern: thin actions, no business logic. Heavy formatting/templating
// belongs in a domain helper, not in the action.
import { v } from "convex/values";
import { businessAction } from "../../lib/functions";
import { resend, FROM_EMAIL } from "../../lib/email";

/**
 * Send the email-channel copy of an in-app notification.
 *
 * Returns the Resend message id. The caller (workflow) is responsible
 * for persisting it back onto the notification row.
 */
export const sendEmailNotification = businessAction({
  args: {
    toEmail: v.string(),
    subject: v.string(),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { toEmail, subject, title, body, actionUrl },
  ): Promise<string> => {
    const html = renderNotificationEmail({ title, body, actionUrl });
    const text = renderNotificationText({ title, body, actionUrl });

    const messageId = await resend.sendEmail(
      ctx,
      FROM_EMAIL,
      toEmail,
      subject,
      html,
      text,
    );

    return messageId;
  },
});

// ── Templating ───────────────────────────────────────────────────────────────
//
// Inline because it's small. If notification email design grows, extract
// to a per-template file under `convex/apps/inAppNotifications/templates/`
// and import here.

function renderNotificationEmail(opts: {
  title: string;
  body: string;
  actionUrl?: string;
}): string {
  const action = opts.actionUrl
    ? `<p><a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View</a></p>`
    : "";
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; line-height: 1.5; max-width: 560px; margin: 40px auto; padding: 0 20px;">
    <h2 style="margin-bottom: 8px;">${escapeHtml(opts.title)}</h2>
    <p style="color: #444;">${escapeHtml(opts.body)}</p>
    ${action}
  </body>
</html>`.trim();
}

function renderNotificationText(opts: {
  title: string;
  body: string;
  actionUrl?: string;
}): string {
  const action = opts.actionUrl ? `\n\n${opts.actionUrl}` : "";
  return `${opts.title}\n\n${opts.body}${action}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
