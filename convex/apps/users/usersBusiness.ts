// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getUserById,
  getUserByAuthId,
  getUserByEmail,
  listUsersByRole,
} from "./usersModel";

export const getUser = businessQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);
    return user;
  },
});

export const getUserByAuth = businessQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) => {
    return getUserByAuthId(ctx, authUserId);
  },
});

// User row creation/sync is handled by the Better Auth trigger in convex/auth.ts.
// Do not add a manual createUser mutation here — it would bypass the trigger
// and leave the Better Auth user table out of sync.

export const updateProfile = businessMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, avatarUrl }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }
  },
});

export const deactivateUser = businessMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);
    if (!user.isActive) throw errors.validation("User is already deactivated");
    await ctx.db.patch(userId, { isActive: false });
  },
});

export const setRole = businessMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, { userId, role }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);
    await ctx.db.patch(userId, { role });
  },
});

export const listAdmins = businessQuery({
  args: {},
  handler: async (ctx) => {
    return listUsersByRole(ctx, "admin");
  },
});