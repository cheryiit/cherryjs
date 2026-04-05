import { BetterAuth } from "@convex-dev/better-auth";
import { components } from "./_generated/api";

export const authComponent = new BetterAuth(components.betterAuth, {
  trustedOrigins: [
    process.env.SITE_URL ?? "http://localhost:3000",
    "http://localhost:*",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});
