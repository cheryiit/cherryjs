import { defineTable } from "convex/server";
import { v } from "convex/values";

export const waitlistEntryFields = {
  email: v.string(),
  name: v.optional(v.string()),
  source: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("rejected"),
  ),
  approvedAt: v.optional(v.number()),
  approvedBy: v.optional(v.id("users")),
  createdAt: v.number(),
};

export const waitlistTables = {
  waitlistEntries: defineTable(waitlistEntryFields)
    .index("by_email", ["email"])
    .index("by_status", ["status", "createdAt"]),
};
