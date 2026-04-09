import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userFields = {
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("user")),
  isActive: v.boolean(),
  emailVerified: v.boolean(),
  /**
   * Better Auth user id. Mirrored from the Better Auth component user table
   * via the trigger in `convex/auth.ts`. This is the value Convex's
   * `getUserIdentity().subject` returns for an authenticated request.
   */
  authUserId: v.string(),
  avatarUrl: v.optional(v.string()),
  lastLoginAt: v.optional(v.number()),
  createdAt: v.number(),
};

export const usersTables = {
  users: defineTable(userFields)
    .index("by_auth_id", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_role", ["role", "isActive"])
    .searchIndex("search_name", { searchField: "name" }),
};
