import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { RequestMeta } from "./request-context";

export type AuditSeverity = "info" | "warn" | "critical";

export type AuditPayload = {
  action: string;
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
