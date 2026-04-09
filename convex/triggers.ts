import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";

const triggers = new Triggers<DataModel>();

// ── User profile changes → audit log via trigger ────────────────────────────
triggers.register("users", async (ctx, change) => {
  if (change.operation === "update" && change.oldDoc && change.newDoc) {
    const oldRole = change.oldDoc.role;
    const newRole = change.newDoc.role;
    if (oldRole !== newRole) {
      await ctx.db.insert("auditLogs", {
        userId: change.newDoc._id,
        action: "user.role_changed",
        resourceType: "user",
        resourceId: change.newDoc._id,
        severity: "warn",
        details: { oldRole, newRole },
        timestamp: Date.now(),
      });
    }
  }
});

// NOTE: Subscription/payment change tracking lives inside the
// `@convex-dev/polar` component (mounted in convex.config.ts). Polar's
// `subscriptions` table is in `components.polar.*` — an isolated namespace
// — so app-level triggers cannot reach it. To react to subscription
// lifecycle events, pass `onSubscriptionCreated` / `onSubscriptionUpdated`
// callbacks to `polar.registerRoutes(http, { ... })` in `convex/http.ts`.

export default triggers;
