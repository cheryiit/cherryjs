import { v } from "convex/values";
import { adminQuery } from "../../lib/functions";
import { internal } from "../../_generated/api";

export const listByUser = adminQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    return ctx.runQuery(
      internal.core.audit.auditBusiness.listByUser,
      { userId, limit },
    );
  },
});

export const listByAction = adminQuery({
  args: {
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { action, limit }) => {
    return ctx.runQuery(
      internal.core.audit.auditBusiness.listByAction,
      { action, limit },
    );
  },
});

export const listBySeverity = adminQuery({
  args: {
    severity: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("critical"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { severity, limit }) => {
    return ctx.runQuery(
      internal.core.audit.auditBusiness.listBySeverity,
      { severity, limit },
    );
  },
});
