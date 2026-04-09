/**
 * Better Auth client — cross-domain mode.
 *
 * Auth requests go directly to the Convex HTTP endpoint (VITE_CONVEX_SITE_URL)
 * where `authComponent.registerRoutes(http, createAuth)` handles them.
 *
 * The `crossDomainClient()` plugin stores session tokens in localStorage
 * (instead of httpOnly cookies) so they work across origins. This is the
 * recommended pattern for Convex + Better Auth when the frontend runs on
 * a different origin (Cloudflare Workers) than the backend (Convex cloud).
 */
import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
