import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const env = {
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL ?? "",
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL ?? "",
};

export const {
  handler,
  getToken,
  fetchAuthQuery: fetchQuery,
  fetchAuthMutation: fetchMutation,
  fetchAuthAction: fetchAction,
} = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
});
