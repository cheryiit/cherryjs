import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import {
  listEmailLogsByRecipient,
  listEmailLogsByTemplate,
} from "./notifications.model";

export const logEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    template: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("failed"),
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", { ...args, sentAt: Date.now() });
  },
});

export const listByRecipient = internalQuery({
  args: {
    to: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { to, limit }) => {
    return listEmailLogsByRecipient(ctx, to, limit);
  },
});

export const listByTemplate = internalQuery({
  args: {
    template: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { template, limit }) => {
    return listEmailLogsByTemplate(ctx, template, limit);
  },
});
