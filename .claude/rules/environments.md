---
description: Convex dev/prod environment separation, env file conventions, and deployment safety
---

# Environment & Deployment Rules

CherryJS uses **three** environments for Convex. Respect the boundaries — prod is sacred.

## Environment Files

| File | Purpose | Committed? |
|------|---------|------------|
| `.env.example` | Template with all required vars (no secrets) | ✅ Yes |
| `.env.local` | Local dev (used by `npm run dev`, `npm run convex:dev`) | ❌ No |
| `.env.dev` | Convex **dev** deployment overrides (optional, usually identical to .env.local) | ❌ No |
| `.env.prod` | Convex **prod** deployment env vars (only set via `convex env set --prod`) | ❌ No |

`.env.local` is generated automatically by `npx convex dev` and contains `CONVEX_DEPLOYMENT=dev:...`.
`.env.prod` should only ever be used as a reference — actual prod env vars live on the Convex deployment, not on disk.

## Convex Deployment Distinction

| Deployment | Set via | Trigger | Notes |
|------------|---------|---------|-------|
| **dev** | `npx convex dev` | Push-on-save during development | `CONVEX_DEPLOYMENT=dev:<name>` |
| **prod** | `npx convex deploy` | Manual or CI/CD | `CONVEX_DEPLOYMENT=prod:<name>` (default) |
| **preview** | `npx convex deploy` with `CONVEX_DEPLOY_KEY=preview-...` | PR previews | One per branch |

> `npx convex deploy` deploys to **prod by default** — there is no `--prod` flag. Read the command twice before running it.

## Env Var Management

### Setting an env var

```bash
# Dev (default)
npx convex env set RESEND_API_KEY re_xxxxx

# Prod (must add --prod explicitly)
npx convex env set RESEND_API_KEY re_xxxxx --prod
```

### Reading env vars

```bash
npx convex env list           # dev
npx convex env list --prod    # prod
npx convex env get NAME --prod
```

### Bulk set from file

```bash
npx convex env set --from-file .env.dev
npx convex env set --from-file .env.prod --prod
```

## Required Env Vars (per environment)

See `.env.example` for the canonical list. Categories:

- **Convex core** — `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`
- **Better-Auth** — `SITE_URL`, `BETTER_AUTH_SECRET`
- **Polar payments** — `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_SERVER`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_PRO`, `POLAR_PRODUCT_TEAM` (consumed by `lib/polar.ts`)
- **Resend email** — `RESEND_API_KEY`, `RESEND_TEST_MODE` (consumed by `lib/email.ts`)
- **Cloudflare R2** — `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (consumed by `lib/storage.ts` via `@convex-dev/r2`)
- **Slack notifications** — `SLACK_WEBHOOK_URL`

Dev and prod **must have the same set of variable names** but different values.
A function that reads `process.env.RESEND_API_KEY` will fail in prod if you forget to set it there.

## Production Safety Rules

1. **Never run `npx convex deploy` without explicit user approval.** This pushes to prod immediately.
2. **Never run destructive operations on prod data** (clear table, drop schema, mass delete) without confirmation.
3. **Read prod env vars carefully** — they may contain real API keys and customer secrets.
4. **Use `--cautiously-allow-production-pii` flag** on Convex MCP server only when read access to prod is genuinely needed.
5. **Never enable `--dangerously-enable-production-deployments`** on the MCP server unless explicitly asked, and disable it again after the task.
6. **Test schema migrations on dev first.** Apply to prod only after verifying on dev.
7. **Never commit any `.env*` file** except `.env.example`.

## Convex MCP Server (for Claude Code)

The Convex CLI ships an MCP server that lets Claude inspect deployments, run functions, and manage env vars. It's configured in `/Users/yigitkiraz/cherryjs/.mcp.json`.

By default the MCP server is **dev-only and safe** — no prod write access. To temporarily allow read-only prod access, edit `.mcp.json` and add the `--cautiously-allow-production-pii` flag. To allow prod writes, add `--dangerously-enable-production-deployments` (not recommended).

### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp__convex__status` | List configured deployments |
| `mcp__convex__tables` | List tables in the deployment |
| `mcp__convex__data` | Read paginated rows from a table |
| `mcp__convex__functionSpec` | List Convex functions with arg/return types |
| `mcp__convex__run` | Execute a query, mutation, or action |
| `mcp__convex__runOneoffQuery` | Sandboxed read-only ad-hoc query |
| `mcp__convex__envList` | List env vars on a deployment |
| `mcp__convex__envGet` | Read one env var |
| `mcp__convex__envSet` | Write an env var (dev only by default) |
| `mcp__convex__envRemove` | Delete an env var (dev only by default) |
| `mcp__convex__logs` | Tail function logs |
| `mcp__convex__insights` | Health insights (slow queries, errors) |

## Bootstrap Steps for a Fresh Clone

1. `npm install`
2. `npx convex dev` — interactive login, creates `.env.local`, links project
3. Stop Convex with Ctrl+C once it says "Convex functions ready"
4. Copy `.env.example` to `.env.local` and fill the non-Convex vars
5. Run `npm run dev` — frontend on http://localhost:3000
6. Run `npm run convex:dev` (separate terminal) — backend with hot reload
