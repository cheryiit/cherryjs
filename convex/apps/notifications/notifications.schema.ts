import { defineTable } from "convex/server";
import { v } from "convex/values";

export const emailLogFields = {
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
  sentAt: v.number(),
};

export const notificationsTables = {
  emailLogs: defineTable(emailLogFields)
    .index("by_to", ["to", "sentAt"])
    .index("by_template", ["template", "sentAt"])
    .index("by_status", ["status"]),
};
