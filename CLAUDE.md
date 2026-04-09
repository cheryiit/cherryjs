# CherryJS Framework

Production framework for AI-driven development. Architectural tests enforce ALL rules below. Break a rule → test fails.

**IMPORTANT: Run `npm run test:arch` after EVERY code change. Do not skip this.**

## Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Convex (reactive BaaS, runs on Convex cloud — never on Cloudflare) |
| **Frontend** | TanStack Start v2 (React 19, file-based routing, SSR) |
| **HTTP** | Hono (mounted inside Convex `http.ts` for webhooks + REST) |
| **Auth** | Better-Auth via `@convex-dev/better-auth` 0.11 (self-hosted, NOT Clerk) |
| **Payments** | `@convex-dev/polar` component (`lib/polar.ts`) — owns customer/product/subscription tables in isolated namespace |
| **Email** | `@convex-dev/resend` component (`lib/email.ts`) — durable batched delivery + webhook callbacks |
| **Storage** | `@convex-dev/r2` component (`lib/storage.ts`) — Cloudflare R2 with managed presigned URLs |
| **In-app notifications** | `apps/inAppNotifications/` domain — bell-icon feed, real-time via Convex queries, multi-channel fan-out |
| **Styling** | Tailwind v4 + OKLCH design tokens + Inter/Urbanist fonts |
| **UI** | Radix primitives + CVA + `cn()` utility |
| **Server state** | TanStack Query + `@convex-dev/react-query` (Convex IS the reactive sync layer) |
| **Client state** | TanStack Store via `createCherryStore()` (drafts, wizards, sidebar — NOT for server data) |
| **Forms** | TanStack Form + Zod via `useCherryForm()` |
| **Tables** | TanStack Table via `useCherryTable()` + `app/components/ui/table.tsx` |
| **Virtualization** | TanStack Virtual via `useCherryVirtual()` (long lists, infinite scrolls) |
| **Pacing** | TanStack Pacer via `app/lib/pacer.ts` (debounce, throttle, batch) |
| **DevTools** | TanStack Router + Query devtools (auto-loaded in dev mode in `__root.tsx`) |
| **Toasts** | Sonner via `withToast()` |
| **Animations** | Framer Motion presets in `app/lib/motion.ts` |
| **Theme** | next-themes (dark mode default) |
| **Frontend Deploy** | Cloudflare Workers via Alchemy (`alchemy.run.ts`) |
| **Backend Deploy** | Convex cloud (`npx convex deploy`) |
| **Build** | Vite 6 (no Vinxi — TanStack Start v2 uses Vite directly) |
| **Tests** | Vitest (architectural tests only — no runtime unit tests yet) |
| **Lint** | dependency-cruiser (import graph), jscpd (duplication), `@convex-dev/eslint-plugin` (Convex anti-patterns), tsc |

## Run & Deploy

**First-time bootstrap (REQUIRED before anything else works):**
```bash
npm install                          # 1. Install deps
npx convex dev                       # 2. Login + link project; generates convex/_generated/ and .env.local
                                     #    Stop with Ctrl+C once it says "Convex functions ready"
```

Without step 2, `convex/_generated/` does not exist and TypeScript will fail with "Cannot find module '../_generated/...'" errors. This is normal — Convex generates types on first run.

**Local development (two terminals):**
```bash
npm run convex:dev       # Terminal 1: Convex backend (push-on-save to dev deployment)
npm run dev              # Terminal 2: Vite dev server (frontend on localhost:3000)
```

**Production deployment (two steps, in order):**
```bash
npx convex deploy        # 1. Deploy backend to Convex prod (NEVER without user approval — prod is the default!)
ALCHEMY=1 npm run deploy # 2. Deploy frontend to Cloudflare Workers via Alchemy
```

The `ALCHEMY=1` env var enables the Alchemy plugin in `vite.config.ts`. Without it, Vite builds in plain mode (used by `npm run build` for testing).

The backend lives on **Convex cloud** always (never bundled into Cloudflare). The frontend SSR runs on **Cloudflare Workers** via Alchemy. They communicate over HTTPS using `VITE_CONVEX_URL`.

## Commands

```bash
npm run test:arch        # 1300+ architectural tests (MUST pass after every change)
npm run lint:deps        # dependency-cruiser: cross-domain, circular deps
npm run lint:duplicates  # jscpd: duplicate code detection (< 10%)
npm run lint:convex      # @convex-dev/eslint-plugin: args validators, table ids, etc.
npm run lint:all         # All three lint checks
npm run check            # Full: tests + deps + duplicates + convex lint + typecheck
npm run typecheck        # tsc --noEmit
npm run dev              # Vite dev server (frontend)
npm run convex:dev       # Convex backend (push-on-save)
npm run deploy           # Cloudflare deploy (frontend, via Alchemy)
```

## Directory Structure

```
convex/
  schema.ts           # Aggregator ONLY — no defineTable here
  convex.config.ts    # 9 components: betterAuth, resend, rateLimiter, actionRetrier, workflow, aggregate, polar, r2
  http.ts             # Hono router: health endpoint + Better-Auth routes + Polar webhook (auto via component)
  auth.ts             # Better-Auth 0.11 setup with user trigger callbacks
  auth.config.ts      # Convex JWT verifier config (Better Auth provider)
  triggers.ts         # DB trigger registry (role changes audited)
  lib/                # 21 shared modules (flat, no subdirs)
                      #   Component instances: polar.ts, storage.ts (R2), email.ts (Resend)
                      #   Wrappers: functions.ts, errors.ts, audit.ts, settings.ts, ...
  core/               # 5 infra modules: audit, parameter, schedule, webhook, content
  apps/{domain}/      # Business domains (flat, no subdirs)
    {domain}Schema.ts, {domain}Model.ts, {domain}Business.ts,
    {domain}Channel.ts, {domain}Integration.ts (optional)
    NOTE: camelCase ONLY. Convex bundler silently skips multi-dot
    filenames like "users.business.ts" — use "usersBusiness.ts".
    Domains: users, payments (Polar wrapper), waitlist, notifications
    (email logs), inAppNotifications (bell-icon real-time feed)

app/
  client.tsx, server.tsx, router.tsx  # Entry points (Cloudflare Workers compatible)
  lib/                # 13 shared utilities
  components/ui/      # 13 Radix+CVA components
  components/layout/  # Navbar, Footer, LayoutMain
  features/           # Feature modules (kebab-case dirs)
  routes/             # TanStack Start file-based routing
  styles/globals.css  # Tailwind v4, OKLCH tokens, dark mode
```

## Things That Will Bite You

1. **Rate limiting is mandatory.** Every channel mutation MUST use `strictMutation`, `normalMutation`, `relaxedMutation`, `burstMutation`, or `adminRateLimitedMutation`. Using `authenticatedMutation` directly in channel → test fails.

2. **No `throw new Error()` anywhere in convex/.** Use `errors.notFound()`, `errors.forbidden()`, `errors.rateLimited()`, etc. from `convex/lib/errors.ts`. Exception: `// cherry:allow` comment on same line.

3. **No cross-domain DB access.** `usersBusiness.ts` cannot `ctx.db.query("subscriptions")`. Use `ctx.runQuery(internal.apps.payments.paymentsBusiness.check, {})` instead.

4. **Flat domain directories with camelCase filenames.** No subdirectories inside `convex/apps/{domain}/`. All files must be `{domain}{Layer}.ts` (e.g. `usersBusiness.ts`, `paymentsChannel.ts`). **NEVER** use multi-dot names like `users.business.ts` — Convex's bundler silently skips them and your module disappears from the deployment.

5. **Schema aggregator only.** `convex/schema.ts` must NOT contain `defineTable()`. Each domain exports `{domain}Tables`, aggregated with spread.

6. **Channel handler max 20 lines.** Channel files max 200 lines total. Business logic goes in business layer.

7. **Model functions: return null, never throw.** Model is pure DB read. Names must be `get*`, `list*`, `find*`, `exists*`, `count*`. No Convex builders allowed in model.

8. **fetch() only in integration files.** If you need external API calls, create `{domain}Integration.ts` with `internalAction`.

9. **Structural firewall.** Files can only exist in approved locations. Random files in `convex/`, `lib/`, `app/` root → test fails. See `tests/structural-integrity.test.ts` for approved file lists.

10. **Frontend: no default exports** in UI components. Named exports only. Component names must start with approved prefix (Button, Card, Dialog, Dropdown, etc.).

11. **Admin operations must be marked.** Any channel export intended for admins MUST have `/** @admin */` JSDoc comment AND use `adminQuery` / `adminRateLimitedMutation`. The test enforces both directions: marked but using wrong wrapper → fail; unmarked admin endpoint → silent risk. Always mark. Critical operations get `/** @admin @critical */` (forces strict rate limiting). See `.claude/rules/admin-security.md`.

12. **Admin mutations must audit.** Every `adminRateLimitedMutation` handler MUST call `ctx.audit.log` / `warn` / `critical`. Enforced by test. Use `// cherry:allow-no-audit` only for genuine no-ops.

13. **Frontend colors: only semantic tokens.** No `bg-blue-500`, `text-[#fff]`, `bg-[oklch(...)]`. Use `bg-primary`, `text-muted-foreground`, etc. from `app/styles/globals.css`. To add a new brand color, add it to both `:root` AND `.dark` blocks, map in `@theme inline`. See `.claude/rules/design-tokens.md`.

14. **Domain `*Business.ts` files use `businessMutation/Query/Action` from `lib/functions`** — never raw `internalMutation/Query/Action` from `_generated/server`. This is a workaround for [Convex issue #53](https://github.com/get-convex/convex-js/issues/53) where TS2589 ("type instantiation excessively deep") fires on every `v.*` call once the schema crosses ~10 tables. The `businessMutation` re-exports keep the proper internal-builder types so `_generated/api.d.ts` still categorizes them under `internal.apps.*`. Domain files also have `// @ts-nocheck` headers; the architectural test enforces the import path. Lib `lib/functions.ts` is the single point to swap when Convex fixes the issue upstream.

15. **Component instances live in `lib/`, never `apps/`.** Each Convex first-party component (`@convex-dev/polar`, `@convex-dev/r2`, `@convex-dev/resend`, `@convex-dev/better-auth`) gets a single instance file in `convex/lib/` (e.g. `lib/polar.ts`, `lib/storage.ts`, `lib/email.ts`). Domain code imports from `lib/`, never from `@convex-dev/*` directly. Mounting happens in `convex/convex.config.ts`. Webhook routes are registered in `convex/http.ts` via `<component>.registerRoutes(http)`.

16. **lib/ must be standalone.** `convex/lib/*.ts` files cannot import from `convex/apps/` or `convex/core/`. Enforced by architectural test AND dependency-cruiser. Component instances in lib/ that need user data resolve it via `ctx.auth.getUserIdentity()` directly.

## What Tests Enforce

| Test File | What It Catches |
|-----------|----------------|
| `backend/architecture` | File naming, line limits, import rules, layer content, error handling, cross-domain, module structure, function naming, schema rules |
| `backend/enforcement` | Rate limit mandatory on channel mutations, forbidden wrapper usage, anti-patterns (.collect().length, fetch outside integration, etc.) |
| `backend/tech-adoption` | Must use getAll() not Promise.all, must use errors.* not new Error, must use lib/email not new Resend, etc. |
| `backend/admin-security` | @admin marker enforcement, admin wrappers only in channel layer, role enum sync, admin mutations must audit, @critical wrapper enforcement |
| `frontend/design-tokens` | No arbitrary colors (`bg-[#...]`), no Tailwind palette (`bg-blue-500`), light/dark token completeness, @theme mapping |
| `structural-integrity` | Filesystem firewall: approved root files, approved lib/core/app modules, flat domains, no random directories |
| `frontend/architecture` | Component prefix naming (51+ types), max line limits per type, named exports, no hardcoded hex, cn() usage, route max 100 lines |
| `frontend/responsive-scoring` | A-F grade: fixed widths > 400px, grid-cols-3+ without responsive, tables without overflow-x-auto |
| `code-quality` | dependency-cruiser 0 violations, jscpd duplication < 10% |

## Critical Rules

| Need | Use | NOT |
|------|-----|-----|
| Error throwing | `errors.notFound()` | `throw new Error()` |
| Multi-ID fetch | `getAll()` from lib/relationships | `Promise.all(ids.map(...))` |
| Counting | aggregate component | `.collect().length` |
| Audit logging | `ctx.audit.log()` | `ctx.db.insert("auditLogs")` |
| File upload | `lib/storage.ts` | direct `new S3Client()` |
| Email | `lib/email.ts` (Resend) | direct `new Resend()` |
| Webhook verify | Convex components (`polar.registerRoutes`, `authComponent.registerRoutes`) | manual HMAC |
| Rate limiting | lib/rateLimiter instance | `new RateLimiter()` |
| DB filtering | `filter()` from lib/filter | `.collect().filter()` |
| Row-level security | `withRls()` from lib/rls | manual per-query checks |
| Class merging | `cn()` from app/lib/utils | manual className concat |
| Forms | `useCherryForm()` from app/lib/form | raw useForm |
| Toasts | `withToast()` from app/lib/toast | manual try/catch + toast |
| Animations | presets from app/lib/motion | inline motion props |
| SEO | `seoHead()` from app/lib/seo | manual meta tags |
| Settings/config reads | `settings.getNumber/Boolean/String()` from lib/settings | direct parameters table query |
| Admin operations | `adminRateLimitedMutation` + `/** @admin */` marker | `normalMutation` |
| Page content / CMS | `core/content/` channel functions | hardcoded text in components |

## Backend Layers

| Layer | Builder | DB | Key Rules |
|-------|---------|-----|-----------|
| **channel** | Rate-limited wrappers | Via runMutation/runQuery | Max 200 lines, handler max 20 lines, must audit |
| **business** | `internalMutation/Query` | Direct ctx.db | ALL logic here, only internal exports |
| **integration** | `internalAction` | NO ctx.db | `fetch()` allowed here ONLY, use retrier for retry |
| **model** | None (pure functions) | Read-only ctx.db | `get*/list*/find*`, return null not throw, no builders |
| **schema** | — | — | Export `{domain}Tables` + `{domain}Fields` |

## Frontend Shared Utilities

| Need | Import |
|------|--------|
| Class merging | `cn()` from `app/lib/utils` |
| Forms + validation + toast | `useCherryForm()` from `app/lib/form` |
| Async toast feedback | `withToast()` from `app/lib/toast` |
| Animations | `fadeIn`, `slideUp`, `scaleIn` from `app/lib/motion` |
| Convex hooks | `useQuery`, `useMutation` from `app/lib/convex` |
| Auth | `signIn`, `signUp`, `signOut` from `app/lib/auth-client` |
| SEO meta tags | `seoHead()` from `app/lib/seo` |
| Feature flags | `config` from `app/lib/config` |
| Data tables | `useCherryTable()` from `app/lib/table` + `Table` UI components |
| Virtualized lists | `useCherryVirtual()` from `app/lib/virtual` (lists 1000+ items) |
| Debounce / throttle | `useDebouncedValue`, `useThrottledCallback` from `app/lib/pacer` |
| Client-only reactive state | `createCherryStore()` + `useStoreSelector()` from `app/lib/store` (NOT for server data) |

## Dependency Direction (enforced by dependency-cruiser)

```
lib/       → nothing (standalone)
core/      → lib/ only
apps/      → lib/ + _generated/api (never other apps/)
channel    → lib/functions wrappers (not business files directly)
model      → nothing (no business, no channel, no integration)
app/components/ → app/lib/ (not convex/ directly)
```

## Environments & Convex MCP

- **dev** = `npx convex dev` (push-on-save), reads `CONVEX_DEPLOYMENT=dev:<name>` from `.env.local`
- **prod** = `npx convex deploy` (NO `--prod` flag — prod is the default!) — sacred, never run without explicit user approval
- Env vars: `npx convex env list` (dev), `npx convex env list --prod` (prod). Bulk: `npx convex env set --from-file .env.dev`
- Templates: `.env.example` (committed), `.env.dev.example`, `.env.prod.example` — actual `.env.*` files are gitignored
- Claude MCP server (`.mcp.json`) gives access to dev tables/env/logs. Prod is read-only with `--cautiously-allow-production-pii`, blocked entirely by default
- See `.claude/rules/environments.md` for full deployment safety rules

## Git & Commits

- Conventional Commits: `<type>(<scope>): <subject>` (feat, fix, refactor, test, docs, chore, style, perf)
- Run `npm run check` before every commit
- Never commit `.env.*` files (except `.example` variants)
- Never `git push --force` to main, never `git reset --hard` published commits
- See `.claude/rules/git-commits.md` for full git workflow

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
