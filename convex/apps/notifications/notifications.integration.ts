import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { resend, FROM_EMAIL } from "../../lib/email";

// ── Email Templates ───────────────────────────────────────────────────────────

function welcomeEmailHtml(name: string, siteUrl: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0C0C0C; color: #E8E4DE;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome${name ? `, ${name}` : ""}!</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #A39E96;">
        Your account has been created. You can now access all features.
      </p>
      <a href="${siteUrl}/dashboard" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #E8E4DE; color: #0C0C0C; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Go to Dashboard
      </a>
    </div>
  `;
}

function waitlistApprovalHtml(name: string, siteUrl: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0C0C0C; color: #E8E4DE;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">You're in${name ? `, ${name}` : ""}!</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #A39E96;">
        Your waitlist application has been approved. Create your account to get started.
      </p>
      <a href="${siteUrl}/signup" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #E8E4DE; color: #0C0C0C; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Create Account
      </a>
    </div>
  `;
}

// ── Send Email Actions ────────────────────────────────────────────────────────

export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }) => {
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    try {
      await resend.sendEmail(
        ctx,
        FROM_EMAIL,
        email,
        "Welcome!",
        welcomeEmailHtml(name ?? "", siteUrl),
      );
    } catch {
      // Email failure should not break the flow
    }
  },
});

export const sendWaitlistApproval = internalAction({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }) => {
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    try {
      await resend.sendEmail(
        ctx,
        FROM_EMAIL,
        email,
        "You're approved!",
        waitlistApprovalHtml(name ?? "", siteUrl),
      );
    } catch {
      // Email failure should not break the flow
    }
  },
});

// ── Slack ─────────────────────────────────────────────────────────────────────

export const sendSlackNotification = internalAction({
  args: {
    text: v.string(),
    blocks: v.optional(v.any()),
  },
  handler: async (_ctx, { text, blocks }) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, blocks }),
      });
    } catch {
      // Slack failure should not break the flow
    }
  },
});
