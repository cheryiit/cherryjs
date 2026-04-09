// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function listAuditLogsByUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit = 50,
) {
  return ctx.db
    .query("auditLogs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);
}

export async function listAuditLogsByAction(
  ctx: QueryCtx,
  action: string,
  limit = 50,
) {
  return ctx.db
    .query("auditLogs")
    .withIndex("by_action", (q) => q.eq("action", action))
    .order("desc")
    .take(limit);
}

export async function listAuditLogsBySeverity(
  ctx: QueryCtx,
  severity: "info" | "warn" | "critical",
  limit = 50,
) {
  return ctx.db
    .query("auditLogs")
    .withIndex("by_severity", (q) => q.eq("severity", severity))
    .order("desc")
    .take(limit);
}