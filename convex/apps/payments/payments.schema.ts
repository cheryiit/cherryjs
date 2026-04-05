import { defineTable } from "convex/server";
import { v } from "convex/values";

export const subscriptionFields = {
  userId: v.optional(v.string()),
  polarId: v.optional(v.string()),
  polarPriceId: v.optional(v.string()),
  currency: v.optional(v.string()),
  interval: v.optional(v.string()),
  status: v.optional(v.string()),
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  amount: v.optional(v.number()),
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  canceledAt: v.optional(v.number()),
  customerCancellationReason: v.optional(v.string()),
  customerCancellationComment: v.optional(v.string()),
  metadata: v.optional(v.any()),
  customerId: v.optional(v.string()),
};

export const paymentFields = {
  polarId: v.string(),
  polarPriceId: v.string(),
  currency: v.string(),
  amount: v.number(),
  status: v.string(),
  productType: v.string(),
  paidAt: v.number(),
  metadata: v.optional(v.any()),
  customerId: v.optional(v.string()),
  userId: v.string(),
};

export const paymentsTables = {
  subscriptions: defineTable(subscriptionFields)
    .index("by_userId", ["userId"])
    .index("by_polarId", ["polarId"]),

  payments: defineTable(paymentFields)
    .index("by_userId", ["userId"])
    .index("by_polarId", ["polarId"]),
};
