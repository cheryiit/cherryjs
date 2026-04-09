/**
 * Better Auth SSR utilities.
 *
 * Server-side helpers for authenticated data fetching in TanStack Start
 * server functions (`createServerFn`). These use the Convex HTTP site
 * URL to fetch a token and then call Convex queries/mutations with it.
 *
 * Usage in a route loader:
 *
 *   import { fetchQuery } from "~/app/lib/auth-server";
 *   import { api } from "~/app/lib/convex";
 *
 *   const user = await fetchQuery(api.apps.users.usersChannel.me, {});
 */
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const env = {
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL ?? "",
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL ?? "",
};

export const {
  getToken,
  fetchAuthQuery: fetchQuery,
  fetchAuthMutation: fetchMutation,
  fetchAuthAction: fetchAction,
} = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
});
