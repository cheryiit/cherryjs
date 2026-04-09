// Convex JWT verification config for Better Auth.
// SITE_URL must be the URL of your frontend (used as the JWT issuer).
// In dev, set SITE_URL=http://localhost:3000 in .env.local
// In prod, set it via `npx convex env set SITE_URL https://your-domain.com`

export default {
  providers: [
    {
      domain: process.env.SITE_URL ?? "http://localhost:3000",
      applicationID: "convex",
    },
  ],
};
