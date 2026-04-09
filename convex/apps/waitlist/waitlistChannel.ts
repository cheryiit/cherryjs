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
  handler: async (ctx, { email, name, source }): Promise<unknown> => {
    return ctx.runMutation(
      internal.apps.waitlist.waitlistBusiness.join,
      { email, name, source },
    );
  },
});

export const checkStatus = publicQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.waitlist.waitlistBusiness.checkStatus,
      { email },
    );
  },
});

/** @admin */
export const listPending = adminQuery({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.waitlist.waitlistBusiness.listPending,
      {},
    );
  },
});

/** @admin */
export const approve = adminRateLimitedMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, { entryId }): Promise<void> => {
    const entry = (await ctx.runMutation(
      internal.apps.waitlist.waitlistBusiness.approve,
      { entryId, approvedBy: ctx.user._id },
    )) as { email: string };

    await ctx.audit.log({
      action: "waitlist.approve",
      resourceType: "waitlistEntry",
      resourceId: entryId,
      details: { email: entry.email },
    });
  },
});
