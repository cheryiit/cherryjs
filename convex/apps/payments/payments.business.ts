import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getActiveSubscription,
  getSubscriptionByPolarId,
  getPaymentByUserId,
} from "./payments.model";

export const checkSubscriptionStatus = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await getActiveSubscription(ctx, userId);
    return { hasActiveSubscription: subscription?.status === "active" };
  },
});

export const hasActivePurchase = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await getActiveSubscription(ctx, userId);
    if (subscription?.status === "active") {
      return { hasPurchase: true, type: "subscription" as const };
    }

    const payment = await getPaymentByUserId(ctx, userId);
    if (payment?.status === "completed") {
      return { hasPurchase: true, type: "payment" as const };
    }

    return { hasPurchase: false, type: null };
  },
});

export const fetchSubscription = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return getActiveSubscription(ctx, userId);
  },
});

export const createSubscription = internalMutation({
  args: {
    userId: v.optional(v.string()),
    polarId: v.string(),
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
    metadata: v.optional(v.any()),
    customerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await getSubscriptionByPolarId(ctx, args.polarId);
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return ctx.db.insert("subscriptions", args);
  },
});

export const updateSubscription = internalMutation({
  args: {
    polarId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, { polarId, updates }) => {
    const subscription = await getSubscriptionByPolarId(ctx, polarId);
    if (!subscription) throw errors.notFound("Subscription", polarId);
    await ctx.db.patch(subscription._id, updates);
  },
});

export const createPayment = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("payments", args);
  },
});

export const handleWebhookEvent = internalMutation({
  args: {
    body: v.any(),
    webhookId: v.optional(v.string()),
  },
  handler: async (ctx, { body, webhookId }) => {
    const eventType: string = body.type;
    const data = body.data;
    const resolvedWebhookId = webhookId ?? body.id;

    // Deduplication via core webhookEvents
    if (resolvedWebhookId) {
      const existing = await ctx.db
        .query("webhookEvents")
        .withIndex("by_provider_external", (q) =>
          q.eq("provider", "polar").eq("externalId", resolvedWebhookId),
        )
        .first();
      if (existing) {
        return { success: true, alreadyProcessed: true };
      }
    }

    // Record webhook event
    await ctx.db.insert("webhookEvents", {
      provider: "polar",
      eventType,
      externalId: resolvedWebhookId ?? body.id ?? "unknown",
      payload: body,
      status: "processing",
      attempts: 1,
      receivedAt: Date.now(),
    });

    // Route event
    switch (eventType) {
      case "subscription.created":
      case "subscription.active":
        await ctx.db.insert("subscriptions", {
          polarId: data.id,
          polarPriceId: data.price_id,
          currency: data.currency,
          interval: data.recurring_interval,
          userId: data.metadata?.userId,
          status: data.status,
          currentPeriodStart: data.current_period_start
            ? new Date(data.current_period_start).getTime()
            : undefined,
          currentPeriodEnd: data.current_period_end
            ? new Date(data.current_period_end).getTime()
            : undefined,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          amount: data.amount,
          startedAt: data.started_at
            ? new Date(data.started_at).getTime()
            : undefined,
          metadata: data.metadata,
          customerId: data.customer_id,
        });
        break;

      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
      case "subscription.revoked": {
        const sub = await getSubscriptionByPolarId(ctx, data.id);
        if (sub) {
          await ctx.db.patch(sub._id, {
            status: data.status,
            amount: data.amount,
            currentPeriodStart: data.current_period_start
              ? new Date(data.current_period_start).getTime()
              : sub.currentPeriodStart,
            currentPeriodEnd: data.current_period_end
              ? new Date(data.current_period_end).getTime()
              : sub.currentPeriodEnd,
            cancelAtPeriodEnd: data.cancel_at_period_end,
            canceledAt: data.canceled_at
              ? new Date(data.canceled_at).getTime()
              : undefined,
            endedAt: data.ended_at
              ? new Date(data.ended_at).getTime()
              : undefined,
            customerCancellationReason: data.customer_cancellation_reason,
            customerCancellationComment: data.customer_cancellation_comment,
          });
        }
        break;
      }

      case "payment.created":
      case "order.created":
        await ctx.db.insert("payments", {
          polarId: data.id,
          polarPriceId: data.price_id ?? data.product_price_id ?? "",
          currency: data.currency ?? "usd",
          amount: data.amount ?? 0,
          status: "completed",
          productType: data.type ?? "one-time",
          paidAt: Date.now(),
          metadata: data.metadata,
          customerId: data.customer_id,
          userId: data.metadata?.userId ?? "",
        });
        break;
    }

    return { success: true, alreadyProcessed: false };
  },
});
