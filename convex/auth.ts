/**
 * Better Auth integration (component v0.10+)
 *
 * This file:
 * 1. Builds the Better Auth component client (`authComponent`) used to
 *    register HTTP routes and read the current user.
 * 2. Defines `createAuth(ctx)` — a per-request factory that returns a
 *    fresh `betterAuth(...)` instance bound to the current Convex ctx.
 * 3. Wires up trigger callbacks: when Better Auth creates/updates/deletes a
 *    user in its own table, we mirror that into our app `users` table.
 *
 * The trigger callbacks must be re-exported as `internal.auth.onCreate`,
 * `internal.auth.onUpdate`, `internal.auth.onDelete` — see the bottom of
 * the file. The `authFunctions` const tells the component where they live.
 */
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

// Where the trigger handlers live in our internal API. The names here MUST
// match the exports at the bottom of this file (onCreate / onUpdate / onDelete).
const authFunctions: AuthFunctions = internal.auth as unknown as AuthFunctions;

// ── Component Client ─────────────────────────────────────────────────────────

export const authComponent = createClient<DataModel>(
  components.betterAuth,
  {
    authFunctions,
    verbose: false,
    triggers: {
      // Whenever Better Auth touches its `user` table, mirror into our app's
      // `users` table so the rest of the app can keep using `Id<"users">`.
      user: {
        onCreate: async (ctx, authUser) => {
          const userId = await ctx.db.insert("users", {
            authUserId: authUser._id,
            name: authUser.name ?? authUser.email?.split("@")[0] ?? "",
            email: authUser.email ?? "",
            role: "user",
            isActive: true,
            emailVerified: !!authUser.emailVerified,
            avatarUrl: authUser.image ?? undefined,
            lastLoginAt: Date.now(),
            createdAt: Date.now(),
          });
          await authComponent.setUserId(ctx, authUser._id, userId);

          // Schedule welcome email — non-blocking, runs in an action context.
          if (authUser.email) {
            await ctx.scheduler.runAfter(
              0,
              internal.apps.notifications.notificationsIntegration
                .sendWelcomeEmail,
              {
                email: authUser.email,
                name: authUser.name ?? undefined,
              },
            );
          }
        },
        onUpdate: async (ctx, newUser, oldUser) => {
          // Find the linked app user via the Better Auth id.
          const appUser = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q: any) =>
              q.eq("authUserId", newUser._id),
            )
            .unique();
          if (!appUser) return;

          const patch: Record<string, unknown> = {};
          if (newUser.email !== oldUser.email) patch.email = newUser.email;
          if (newUser.name !== oldUser.name) patch.name = newUser.name;
          if (newUser.image !== oldUser.image)
            patch.avatarUrl = newUser.image ?? undefined;
          if (newUser.emailVerified !== oldUser.emailVerified)
            patch.emailVerified = !!newUser.emailVerified;

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(appUser._id, patch);
          }
        },
        onDelete: async (ctx, authUser) => {
          const appUser = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q: any) =>
              q.eq("authUserId", authUser._id),
            )
            .unique();
          if (appUser) {
            // Soft delete — preserve the row for audit history.
            await ctx.db.patch(appUser._id, { isActive: false });
          }
        },
      },
    },
  },
);

// Re-export trigger handlers as Convex internal mutations so
// `internal.auth.onCreate/onUpdate/onDelete` actually exist at runtime.
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

// ── createAuth — per-request Better Auth factory ─────────────────────────────

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    account: { accountLinking: { enabled: true } },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions);
