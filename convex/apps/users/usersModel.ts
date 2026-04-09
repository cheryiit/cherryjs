import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function getUserById(ctx: QueryCtx, id: Id<"users">) {
  return ctx.db.get(id);
}

export async function getUserByAuthId(ctx: QueryCtx, authUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authUserId", authUserId))
    .unique();
}

export async function getUserByEmail(ctx: QueryCtx, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

export async function listUsersByRole(
  ctx: QueryCtx,
  role: "admin" | "user",
  activeOnly = true,
) {
  return ctx.db
    .query("users")
    .withIndex("by_role", (q) =>
      activeOnly ? q.eq("role", role).eq("isActive", true) : q.eq("role", role),
    )
    .collect();
}

export async function existsUserByEmail(
  ctx: QueryCtx,
  email: string,
): Promise<boolean> {
  const user = await getUserByEmail(ctx, email);
  return user !== null;
}
