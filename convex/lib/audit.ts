import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { RequestMeta } from "./requestContext";

// ── Audit Categories ─────────────────────────────────────────────────────────
//
// Typed action strings. Using these instead of raw strings prevents typos
// and enables searching "who logs what" across the codebase.
//
// Naming: `domain.verb` or `domain.verb_noun`
//
// To add a new category: add a key here and reference it via
// `AuditCategory.USER_ROLE_CHANGED` in your audit call.

export const AuditCategory = {
  // Auth
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SIGNUP: "auth.signup",
  AUTH_FAILED_LOGIN: "auth.failed_login",
  AUTH_PASSWORD_RESET: "auth.password_reset",

  // User management
  USER_ROLE_CHANGED: "user.role_changed",
  USER_PROFILE_UPDATED: "user.profile_updated",
  USER_DEACTIVATED: "user.deactivated",
  USER_BANNED: "user.banned",

  // Payments
  PAYMENT_CHECKOUT: "payment.checkout",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",
  SUBSCRIPTION_CHANGED: "subscription.changed",
  SUBSCRIPTION_CANCELED: "subscription.canceled",

  // Content
  CONTENT_UPSERTED: "content.upserted",
  CONTENT_PUBLISHED: "content.published",
  CONTENT_DELETED: "content.deleted",

  // Parameters / settings
  PARAMETER_SET: "parameter.set",
  PARAMETER_DELETED: "parameter.deleted",

  // Notifications
  NOTIFICATION_SENT: "notification.sent",
  NOTIFICATION_BROADCAST: "notification.broadcast",

  // System
  SYSTEM_MAINTENANCE_ON: "system.maintenance_on",
  SYSTEM_MAINTENANCE_OFF: "system.maintenance_off",
  SYSTEM_CRON_TOGGLED: "system.cron_toggled",
  SYSTEM_CRON_FAILED: "system.cron_failed",
} as const;

export type AuditCategory =
  (typeof AuditCategory)[keyof typeof AuditCategory];

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditSeverity = "info" | "warn" | "critical";

export type AuditPayload = {
  action: string | AuditCategory;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
};

export type AuditHelper = {
  log: (payload: AuditPayload) => Promise<void>;
  warn: (payload: Omit<AuditPayload, "severity">) => Promise<void>;
  critical: (payload: Omit<AuditPayload, "severity">) => Promise<void>;
};

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildAuditHelper(
  ctx: MutationCtx,
  userId: Id<"users">,
  requestMeta: RequestMeta | null,
): AuditHelper {
  const write = async (payload: AuditPayload) => {
    await ctx.db.insert("auditLogs", {
      userId,
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      details: payload.details,
      severity: payload.severity ?? "info",
      userAgent: requestMeta?.userAgent,
      language: requestMeta?.language,
      timezone: requestMeta?.timezone,
      timestamp: Date.now(),
    });
  };

  return {
    log: write,
    warn: (payload) => write({ ...payload, severity: "warn" }),
    critical: (payload) => write({ ...payload, severity: "critical" }),
  };
}

// ── Retention ────────────────────────────────────────────────────────────────
//
// Default retention periods per severity. Override with settings if needed.
// Used by `core/audit/auditBusiness.cleanupOldLogs`.

export const RETENTION_DAYS: Record<AuditSeverity, number> = {
  info: 90,
  warn: 365,
  critical: 730, // 2 years — keep critical logs for compliance
};
