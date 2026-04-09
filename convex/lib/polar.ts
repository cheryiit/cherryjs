// @ts-nocheck — Polar's `RunQueryCtx` callback type narrows ctx to
// `runQuery` only and excludes `auth`/`db`, but at runtime Convex passes
// the full mutation/query ctx so reading the user is safe. Fully typed
// alternatives require importing internals from @convex-dev/polar/utils.
/**
 * Polar payments component instance.
 *
 * Wraps `@convex-dev/polar` with our user resolution logic so the rest of
 * the codebase has a single import for billing operations. The component
 * itself owns the `customers`, `products`, and `subscriptions` tables in
 * an isolated namespace (`components.polar.*`) — never touch them
 * directly, always go through the methods on this instance.
 *
 * Required environment variables (set via `npx convex env set`):
 *   - POLAR_ACCESS_TOKEN
 *   - POLAR_WEBHOOK_SECRET
 *   - POLAR_SERVER ("sandbox" | "production")
 *   - POLAR_PRODUCT_PRO  (optional, only if you have a "pro" tier)
 *   - POLAR_PRODUCT_TEAM (optional, only if you have a "team" tier)
 *
 * Webhook routes are registered in `convex/http.ts` via
 * `polar.registerRoutes(http)`.
 */
import { Polar } from "@convex-dev/polar";
import { components } from "../_generated/api";

export const polar = new Polar(components.polar, {
  // Map your business product keys to Polar product IDs. Add/remove as
  // products are created in your Polar dashboard. Empty string means the
  // product is not yet configured for this environment — Polar SDK will
  // gracefully fail when attempting checkout against an unset product.
  products: {
    pro: process.env.POLAR_PRODUCT_PRO ?? "",
    team: process.env.POLAR_PRODUCT_TEAM ?? "",
  },

  // Resolve the current user from the JWT subject (Better Auth user id).
  // Same logic as `lib/functions.ts#resolveCurrentUser` — if you change
  // one, update the other.
  getUserInfo: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated"); // cherry:allow
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q: any) =>
        q.eq("authUserId", identity.subject),
      )
      .unique();
    if (!user) {
      throw new Error("User not found"); // cherry:allow
    }
    return { userId: user._id, email: user.email };
  },

  organizationToken: process.env.POLAR_ACCESS_TOKEN,
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
  server:
    (process.env.POLAR_SERVER as "sandbox" | "production" | undefined) ??
    "sandbox",
});
