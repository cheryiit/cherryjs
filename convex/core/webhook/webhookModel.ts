// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
import type { QueryCtx } from "../../_generated/server";

export async function getWebhookEventByExternalId(
  ctx: QueryCtx,
  provider: string,
  externalId: string,
) {
  return ctx.db
    .query("webhookEvents")
    .withIndex("by_provider_external", (q) =>
      q.eq("provider", provider).eq("externalId", externalId),
    )
    .first();
}

export async function listWebhookEventsByStatus(
  ctx: QueryCtx,
  status: "pending" | "processing" | "completed" | "failed",
) {
  return ctx.db
    .query("webhookEvents")
    .withIndex("by_status", (q) => q.eq("status", status))
    .collect();
}

export async function listWebhookEventsByProvider(
  ctx: QueryCtx,
  provider: string,
  eventType?: string,
) {
  if (eventType) {
    return ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_type", (q) =>
        q.eq("provider", provider).eq("eventType", eventType),
      )
      .order("desc")
      .take(50);
  }
  return ctx.db
    .query("webhookEvents")
    .withIndex("by_provider_type", (q) => q.eq("provider", provider))
    .order("desc")
    .take(50);
}