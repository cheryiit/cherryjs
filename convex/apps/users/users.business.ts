import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getUserById,
  getUserByToken,
  getUserByEmail,
  listUsersByRole,
} from "./users.model";

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);
    return user;
  },
});

export const getUserByTokenIdentifier = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    return getUserByToken(ctx, tokenIdentifier);
  },
});

export const createOrUpdateFromClerk = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { tokenIdentifier, name, email, avatarUrl }) => {
    const existing = await getUserByToken(ctx, tokenIdentifier);

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email,
        avatarUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      tokenIdentifier,
      name,
      email,
      role: "user",
      isActive: true,
      emailVerified: false,
      avatarUrl,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const updateProfile = internalMutation({
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

export const deactivateUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getUserById(ctx, userId);
    if (!user) throw errors.notFound("User", userId);
    if (!user.isActive) throw errors.validation("User is already deactivated");
    await ctx.db.patch(userId, { isActive: false });
  },
});

export const setRole = internalMutation({
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

export const listAdmins = internalQuery({
  args: {},
  handler: async (ctx) => {
    return listUsersByRole(ctx, "admin");
  },
});
