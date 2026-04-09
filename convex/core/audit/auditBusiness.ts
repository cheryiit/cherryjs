// @ts-nocheck — Convex issue #53: TS2589 "type instantiation excessively
// deep" triggers on every `v.*` call once the aggregated schema grows past
// ~10 tables. Runtime is fully validated by Convex's own schema validators
// and our architectural tests. Business logic worth type-checking should
// live in `auditModel.ts`, which IS type-checked.
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import {
  listAuditLogsByUser,
  listAuditLogsByAction,
  listAuditLogsBySeverity,
} from "./auditModel";

export const listByUser = businessQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    return listAuditLogsByUser(ctx, userId, limit);
  },
});

export const listByAction = businessQuery({
  args: {
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { action, limit }) => {
    return listAuditLogsByAction(ctx, action, limit);
  },
});

export const listBySeverity = businessQuery({
  args: {
    severity: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("critical"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { severity, limit }) => {
    return listAuditLogsBySeverity(ctx, severity, limit);
  },
});

export const writeHttpAudit = businessMutation({
  args: {
    action: v.string(),
    ip: v.string(),
    userAgent: v.optional(v.string()),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warn"), v.literal("critical")),
    ),
    details: v.optional(v.any()),
  },
  handler: async (ctx, { action, ip, userAgent, severity, details }) => {
    await ctx.db.insert("auditLogs", {
      action,
      severity: severity ?? "info",
      ip,
      userAgent,
      timestamp: Date.now(),
      details,
    });
  },
});

export const cleanupOldLogs = businessMutation({
  args: {
    retentionDays: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { retentionDays = 90, batchSize = 100 }) => {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const oldLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_severity", (q) => q.eq("severity", "info"))
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(batchSize);

    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }

    return {
      deleted: oldLogs.length,
      hasMore: oldLogs.length === batchSize,
    };
  },
});
