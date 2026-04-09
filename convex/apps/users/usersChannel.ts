import { v } from "convex/values";
import {
  authenticatedQuery,
  normalMutation,
  adminQuery,
  adminRateLimitedMutation,
} from "../../lib/functions";
import { internal } from "../../_generated/api";

export const me = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.user;
  },
});

export const updateProfile = normalMutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(
      internal.apps.users.usersBusiness.updateProfile,
      { userId: ctx.user._id, ...args },
    );

    await ctx.audit.log({
      action: "user.updateProfile",
      resourceType: "user",
      resourceId: ctx.user._id,
    });
  },
});

/** @admin */
export const listAdmins = adminQuery({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return ctx.runQuery(
      internal.apps.users.usersBusiness.listAdmins,
      {},
    );
  },
});

export const setRole = adminRateLimitedMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, { userId, role }) => {
    await ctx.runMutation(
      internal.apps.users.usersBusiness.setRole,
      { userId, role },
    );

    await ctx.audit.critical({
      action: "user.setRole",
      resourceType: "user",
      resourceId: userId,
      details: { newRole: role },
    });
  },
});

export const deactivateUser = adminRateLimitedMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    await ctx.runMutation(
      internal.apps.users.usersBusiness.deactivateUser,
      { userId },
    );

    await ctx.audit.critical({
      action: "user.deactivate",
      resourceType: "user",
      resourceId: userId,
    });
  },
});
