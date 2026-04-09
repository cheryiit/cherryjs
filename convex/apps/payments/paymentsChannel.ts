// @ts-nocheck — Convex issue #53: TS2589 on large schemas (see lib/functions.ts).
//
// Payments domain — thin wrapper over the @convex-dev/polar component.
//
// We expose two flavors of API:
//
// 1. Direct re-exports from `polar.api()` — Polar's own typed actions and
//    queries. These are public, callable from the frontend with no extra
//    auth wrapping (Polar's `getUserInfo` callback in lib/polar.ts handles
//    auth resolution by reading the current JWT identity).
//
// 2. Custom wrappers using our auth/rate-limit tiers — for endpoints that
//    need extra audit logging or admin gating.
//
// All payment data lives in the Polar component's isolated namespace
// (`components.polar.*`) — there are no `payments` or `subscriptions`
// tables in the app schema anymore.
import { polar } from "../../lib/polar";

// ── Re-exported Polar API (public, auth-resolved internally) ─────────────────
//
// These calls are exposed as `api.apps.payments.paymentsChannel.foo` to the
// frontend. Polar's getUserInfo callback enforces authentication.
//
// cherry:allow — Polar's api() returns its own pre-built RegisteredQuery /
// RegisteredAction values, not our wrapper builders. The arch test expects
// channel exports to use our wrappers, but Polar's typed pre-built API is
// the right call here. Custom wrapped versions can be added below if a
// specific endpoint needs admin gating or audit logging.
export const {
  // Read endpoints
  getConfiguredProducts,
  listAllProducts,
  listAllSubscriptions,
  // Action endpoints
  generateCheckoutLink,
  generateCustomerPortalUrl,
  changeCurrentSubscription,
  cancelCurrentSubscription,
} = polar.api();
