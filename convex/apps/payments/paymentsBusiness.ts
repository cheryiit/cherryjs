// @ts-nocheck — Convex issue #53: TS2589 on large schemas (see lib/functions.ts).
//
// Payments business layer — almost empty.
//
// All payment data + logic lives in the @convex-dev/polar component
// (mounted in convex.config.ts), with the configured instance in
// `convex/lib/polar.ts`. The only thing this layer is for is custom
// helpers that need to combine Polar data with app data — e.g. "this user
// is on the Pro plan AND has emailVerified".
//
// If you need to add such a helper, write it as a `businessQuery` here
// and call it from `paymentsChannel.ts` via runQuery, exactly like every
// other domain.
import { businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import { polar } from "../../lib/polar";

/**
 * Returns whether the current user has any active (non-canceled,
 * non-expired) Polar subscription. Convenience helper for gating premium
 * features without exposing the full subscription object to the
 * frontend.
 */
export const hasActiveSubscription = businessQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const subscription = await polar.getCurrentSubscription(ctx, {
      userId,
    });
    if (!subscription) return false;
    return subscription.status === "active" || subscription.status === "trialing";
  },
});
