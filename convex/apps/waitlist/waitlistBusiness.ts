// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
import { businessMutation, businessQuery } from "../../lib/functions";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getWaitlistEntryByEmail,
  listWaitlistEntriesByStatus,
  countPendingBefore,
} from "./waitlistModel";

export const join = businessMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { email, name, source }) => {
    const existing = await getWaitlistEntryByEmail(ctx, email);
    if (existing) {
      throw errors.alreadyExists("WaitlistEntry", "email");
    }

    return ctx.db.insert("waitlistEntries", {
      email,
      name,
      source,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const checkStatus = businessQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const entry = await getWaitlistEntryByEmail(ctx, email);
    if (!entry) return { status: "not_found" as const, position: null };

    if (entry.status === "pending") {
      const position = await countPendingBefore(ctx, entry.createdAt);
      return { status: entry.status, position: position + 1 };
    }

    return { status: entry.status, position: null };
  },
});

export const approve = businessMutation({
  args: {
    entryId: v.id("waitlistEntries"),
    approvedBy: v.id("users"),
  },
  handler: async (ctx, { entryId, approvedBy }) => {
    const entry = await ctx.db.get(entryId);
    if (!entry) throw errors.notFound("WaitlistEntry", entryId);
    if (entry.status !== "pending") {
      throw errors.validation(`Entry is already ${entry.status}`);
    }

    await ctx.db.patch(entryId, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy,
    });

    // Schedule approval email
    await ctx.scheduler.runAfter(
      0,
      internal.apps.notifications.notificationsIntegration.sendWaitlistApproval,
      { email: entry.email, name: entry.name },
    );

    return entry;
  },
});

export const reject = businessMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, { entryId }) => {
    const entry = await ctx.db.get(entryId);
    if (!entry) throw errors.notFound("WaitlistEntry", entryId);

    await ctx.db.patch(entryId, { status: "rejected" });
  },
});

export const listPending = businessQuery({
  args: {},
  handler: async (ctx) => {
    return listWaitlistEntriesByStatus(ctx, "pending");
  },
});

export const listAll = businessQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("waitlistEntries").order("desc").collect();
  },
});