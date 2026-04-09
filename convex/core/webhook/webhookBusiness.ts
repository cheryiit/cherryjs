// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getWebhookEventByExternalId,
  listWebhookEventsByStatus,
} from "./webhookModel";

export const receiveWebhook = businessMutation({
  args: {
    provider: v.string(),
    eventType: v.string(),
    externalId: v.string(),
    payload: v.any(),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, { provider, eventType, externalId, payload, ip }) => {
    const existing = await getWebhookEventByExternalId(
      ctx,
      provider,
      externalId,
    );
    if (existing) {
      return { eventId: existing._id, duplicate: true };
    }

    const eventId = await ctx.db.insert("webhookEvents", {
      provider,
      eventType,
      externalId,
      payload,
      status: "pending",
      attempts: 0,
      receivedAt: Date.now(),
      ip,
    });

    return { eventId, duplicate: false };
  },
});

export const markProcessing = businessMutation({
  args: {
    eventId: v.id("webhookEvents"),
  },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw errors.notFound("WebhookEvent", eventId);

    await ctx.db.patch(eventId, {
      status: "processing",
      attempts: event.attempts + 1,
    });
  },
});

export const markCompleted = businessMutation({
  args: {
    eventId: v.id("webhookEvents"),
  },
  handler: async (ctx, { eventId }) => {
    await ctx.db.patch(eventId, {
      status: "completed",
      processedAt: Date.now(),
    });
  },
});

export const markFailed = businessMutation({
  args: {
    eventId: v.id("webhookEvents"),
    error: v.string(),
  },
  handler: async (ctx, { eventId, error }) => {
    await ctx.db.patch(eventId, {
      status: "failed",
      lastError: error,
    });
  },
});

export const listPending = businessQuery({
  args: {},
  handler: async (ctx) => {
    return listWebhookEventsByStatus(ctx, "pending");
  },
});