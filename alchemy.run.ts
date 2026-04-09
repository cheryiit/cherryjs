/**
 * Alchemy deployment config for Cloudflare Workers.
 *
 * Usage:
 *   npm run deploy             # Deploy to Cloudflare
 *   npm run deploy:destroy     # Tear down deployment
 *
 * Required env vars (in shell, not in .mcp.json):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   VITE_CONVEX_URL            (from `npx convex deploy` output)
 *   VITE_CONVEX_SITE_URL       (the deployed Convex HTTP URL)
 */
import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";

const app = await alchemy("cherryjs");

export const web = await TanStackStart("web", {
  bindings: {
    // Convex URLs (auto-managed via VITE_ prefix → embedded in client bundle)
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL ?? "",
    VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL ?? "",
    SITE_URL: process.env.SITE_URL ?? "",
  },
  dev: {
    command: "npm run dev",
  },
});

console.log(`Web -> ${web.url}`);

await app.finalize();
