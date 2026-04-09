/**
 * Payments schema — empty.
 *
 * All payment-related tables (`customers`, `products`, `subscriptions`)
 * live in the `@convex-dev/polar` component's isolated namespace
 * (`components.polar.*`). They are NOT part of the app schema and cannot
 * be queried directly with `ctx.db.query("subscriptions")`.
 *
 * To read payment data, go through `convex/lib/polar.ts` which exposes
 * the configured Polar instance with `polar.getCurrentSubscription(...)`,
 * `polar.listProducts(...)`, etc.
 *
 * This file exists only because the architectural test requires every
 * domain to have a `{domain}Schema.ts`. The empty `paymentsTables` and
 * `paymentFields` exports keep the schema aggregator and tests happy
 * without registering any tables.
 */

export const paymentFields = {} as const;
export const paymentsTables = {};
