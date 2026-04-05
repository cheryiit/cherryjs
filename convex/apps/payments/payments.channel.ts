import { v } from "convex/values";
import { authenticatedQuery } from "../../lib/functions";
import { internal } from "../../_generated/api";

export const checkSubscription = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.apps.payments.paymentsBusiness.checkSubscriptionStatus,
      { userId: ctx.user._id },
    );
  },
});

export const hasActivePurchase = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.apps.payments.paymentsBusiness.hasActivePurchase,
      { userId: ctx.user._id },
    );
  },
});

export const fetchSubscription = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.apps.payments.paymentsBusiness.fetchSubscription,
      { userId: ctx.user._id },
    );
  },
});
