# Getting Started

Clone → running deployment in 5 minutes.

## Prerequisites

- Node.js 20+
- npm 10+
- A Convex account ([convex.dev](https://convex.dev) — free tier is fine)

## 1. Install

```bash
git clone <your-repo-url> cherryjs
cd cherryjs
npm install          # .npmrc already sets legacy-peer-deps=true
```

## 2. Initialize Convex

```bash
npx convex dev
```

This will:
1. Open your browser for Convex login (GitHub OAuth)
2. Create or link a dev deployment
3. Generate `convex/_generated/` (TypeScript types)
4. Create `.env.local` with `CONVEX_DEPLOYMENT=dev:<name>`
5. Push schema + functions to the dev deployment
6. Enter watch mode (hot-push on file save)

**Stop with Ctrl+C** once you see `✔ Convex functions ready!`.

> **Common issue:** If you see `✖ Error: ... SITE_URL ...`, run:
> ```bash
> npx convex env set SITE_URL http://localhost:3000
> ```
> Then retry `npx convex dev`.

## 3. Verify

```bash
npm run check
```

Expected output:
```
✓ test:arch          1300+ tests pass
✓ lint:deps          0 violations
✓ lint:duplicates    <10% duplication
✓ lint:convex        0 ESLint errors
✓ typecheck          0 TypeScript errors
```

If all green, you're ready.

## 4. Run locally (two terminals)

```bash
# Terminal 1: Convex backend (hot-push)
npm run convex:dev

# Terminal 2: Vite frontend
npm run dev
```

Frontend runs on [http://localhost:3000](http://localhost:3000).

## 5. Set up services (optional)

Each service needs env vars set on the Convex deployment:

```bash
# Polar payments
npx convex env set POLAR_ACCESS_TOKEN polar_oat_xxx
npx convex env set POLAR_WEBHOOK_SECRET whsec_xxx
npx convex env set POLAR_SERVER sandbox

# Resend email
npx convex env set RESEND_API_KEY re_xxx
npx convex env set RESEND_TEST_MODE true

# Cloudflare R2 storage
npx convex env set R2_BUCKET your-bucket
npx convex env set R2_ENDPOINT https://xxx.r2.cloudflarestorage.com
npx convex env set R2_ACCESS_KEY_ID xxx
npx convex env set R2_SECRET_ACCESS_KEY xxx

# Better Auth
npx convex env set BETTER_AUTH_SECRET $(openssl rand -base64 32)
```

See `.env.example` for the full list.

## 6. Add a new domain

Use the scaffolding template:

```bash
cp -r convex/apps/_template convex/apps/myDomain
# Rename files: _template{Layer}.ts → myDomain{Layer}.ts
# Find-replace "_template" → "myDomain" in file contents
# Add to convex/schema.ts: import + spread
npm run test:arch    # Fix any violations
```

Or use the Claude Code skill: `/add-domain myDomain`

## Known Gotchas

1. **Multi-dot filenames** — `users.business.ts` is silently skipped by
   Convex. Use `usersBusiness.ts` (camelCase, single dot for extension).

2. **TS2589 "type instantiation too deep"** — Known Convex issue (#53)
   with large schemas. Domain files use `// @ts-nocheck` + business
   builder re-exports from `lib/functions.ts` as workaround.

3. **`_generated/` missing** — Run `npx convex dev` once. Types are
   generated on first push.

4. **Rate limiting enforcement** — Every channel mutation MUST use a
   rate-limited wrapper (`normalMutation`, `strictMutation`, etc.).
   Using `authenticatedMutation` directly → arch test fails.

5. **Admin marker** — Any admin channel export needs `/** @admin */`
   JSDoc + `adminRateLimitedMutation` + `ctx.audit.log()`. All three
   enforced by test.

## Deploy to production

```bash
# 1. Backend (pushes to Convex prod — CAREFUL)
npx convex deploy

# 2. Frontend (Cloudflare Workers via Alchemy)
ALCHEMY=1 npm run deploy
```

Set prod env vars separately:
```bash
npx convex env set SITE_URL https://your-domain.com --prod
npx convex env set POLAR_SERVER production --prod
# ... etc
```
