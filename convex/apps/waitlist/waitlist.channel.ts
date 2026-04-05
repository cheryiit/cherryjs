import { v } from "convex/values";
import {
  publicStrictMutation,
  publicQuery,
  adminQuery,
  adminRateLimitedMutation,
} from "../../lib/functions";
import { internal } from "../../_generated/api";

export const join = publicStrictMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { email, name, source }) => {
    return ctx.runMutation(
      internal.apps.waitlist.waitlistBusiness.join,
      { email, name, source },
    );
  },
});

export const checkStatus = publicQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.runQuery(
      internal.apps.waitlist.waitlistBusiness.checkStatus,
      { email },
    );
  },
});

export const listPending = adminQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.apps.waitlist.waitlistBusiness.listPending,
      {},
    );
  },
});

export const approve = adminRateLimitedMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, { entryId }) => {
    const entry = await ctx.runMutation(
      internal.apps.waitlist.waitlistBusiness.approve,
      { entryId, approvedBy: ctx.user._id },
    );

    await ctx.audit.log({
      action: "waitlist.approve",
      resourceType: "waitlistEntry",
      resourceId: entryId,
      details: { email: entry.email },
    });
  },
});
