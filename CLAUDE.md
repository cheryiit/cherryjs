# CherryJS Framework — AI Agent Guide

This is the authoritative reference for AI coding agents working on this project.
826 architectural tests enforce every rule below. Break a rule → test fails.

## Stack

- **Backend:** Convex (reactive BaaS) + Hono (HTTP)
- **Frontend:** TanStack Start (SSR) + React 19 + TanStack Query
- **Auth:** Better-Auth (self-hosted, `@convex-dev/better-auth`)
- **Payments:** Polar (optional, `convex/apps/payments/`)
- **Email:** Resend (`@convex-dev/resend`)
- **Storage:** Cloudflare R2 (S3-compatible presigned URLs)
- **UI:** Radix + CVA + Tailwind v4 + Lucide icons
- **Deploy:** Cloudflare Workers (Alchemy)
- **Quality:** dependency-cruiser, jscpd, knip

## Directory Structure — Strict

```
convex/
├── schema.ts              # Aggregator only (NO defineTable here)
├── convex.config.ts       # Component declarations
├── triggers.ts            # DB trigger registry
├── http.ts                # Hono HTTP router + webhooks
├── auth.ts                # Better-Auth setup
├── lib/                   # 19 shared modules (FLAT, no subdirs)
│   ├── functions.ts       # ALL function wrappers (19 exports)
│   ├── errors.ts          # errors.* factory (NEVER throw new Error)
│   ├── rate-limiter.ts    # Named rate limit configs
│   ├── audit.ts           # ctx.audit.log/warn/critical
│   ├── permissions.ts     # RBAC: Role, Permission, canPerform
│   ├── rls.ts             # Row-Level Security rules
│   ├── validators.ts      # literals(), nullable(), partial()
│   ├── relationships.ts   # getAll, getManyFrom, getManyVia
│   ├── filter.ts          # JS predicate filtering
│   ├── migrations.ts      # Stateful batch migrations
│   ├── email.ts           # Resend instance
│   ├── storage.ts         # R2 presigned URL helpers
│   ├── search.ts          # Text search helper
│   ├── webhook-verify.ts  # HMAC-SHA256 signature verification
│   ├── request-context.ts # RequestMeta type, IP extraction
│   ├── retrier.ts         # Action retry with backoff
│   ├── workflow.ts        # Durable multi-step workflows
│   ├── sessions.ts        # Anonymous session tracking
│   └── cors.ts            # CORS for HTTP routes
├── core/                  # Infrastructure (4 modules)
│   ├── core.schema.ts     # 6 tables: auditLogs, parameters, scheduledTasks, cronConfigs, webhookEvents, migrations
│   ├── audit/             # audit.model.ts, audit.business.ts, audit.channel.ts
│   ├── parameter/         # parameter.model.ts, parameter.business.ts, parameter.channel.ts
│   ├── schedule/          # schedule.model.ts, schedule.business.ts, schedule.channel.ts
│   └── webhook/           # webhook.model.ts, webhook.business.ts
└── apps/                  # Business domains
    ├── users/             # users.schema.ts, users.model.ts, users.business.ts, users.channel.ts
    ├── payments/          # + payments.integration.ts (Polar API calls)
    ├── waitlist/          # Public signup + admin approval
    └── notifications/     # + notifications.integration.ts (Resend + Slack)

app/
├── client.tsx             # Client hydration entry
├── server.tsx             # SSR stream handler
├── router.tsx             # ConvexReactClient + QueryClient + ConvexQueryClient
├── routes/
│   ├── __root.tsx         # Provider stack: Convex → Theme → Toaster
│   ├── index.tsx          # Landing page
│   ├── dashboard.tsx      # Auth-required dashboard
│   └── api/auth/$.ts      # Better-Auth API catch-all
├── lib/                   # 9 shared utilities
│   ├── utils.ts           # cn() — clsx + tailwind-merge
│   ├── auth-client.ts     # Better-Auth React client
│   ├── auth-server.ts     # SSR token management
│   ├── config.ts          # Feature flags
│   ├── convex.ts          # Convex hooks + error extraction
│   ├── form.ts            # useCherryForm() + TanStack Form
│   ├── motion.ts          # Framer Motion presets (fadeIn, slideUp, etc.)
│   ├── seo.ts             # JSON-LD + meta tag helpers
│   └── toast.ts           # withToast() async wrapper
├── components/
│   ├── ui/                # 12 Radix+CVA components (Button, Card, Dialog, etc.)
│   ├── layout/            # Layout components (Header, Footer, Sidebar)
│   └── common/            # Shared across features
├── features/              # Feature modules (kebab-case dirs)
├── styles/
│   └── globals.css        # Tailwind v4, OKLCH tokens, dark mode, fonts
└── contexts/              # React context providers
```

## Backend Rules

### File Naming (ENFORCED)
Every file in `apps/{domain}/` MUST be named `{domain}.{layer}.ts`.
Approved layers: `channel`, `business`, `integration`, `model`, `schema`, `schedule`, `batch`, `test`

### Layer Rules

| Layer | Builder | Can do |
|-------|---------|--------|
| **channel** | Rate-limited wrappers only | Delegate to business, write audit log |
| **business** | `internalMutation/Query` only | ALL business logic, DB access |
| **integration** | `internalAction` only | External API calls (`fetch`), NO ctx.db |
| **model** | None (pure functions) | DB read helpers, return null not throw |
| **schema** | — | Table definitions, export `{domain}Tables` + `{domain}Fields` |

### Wrapper Rules (channel files)

**Mutations** MUST use rate-limited wrappers:
- `strictMutation` (5/min) — payments, critical ops
- `normalMutation` (30/min) — standard CRUD
- `relaxedMutation` (100/min) — low-risk
- `burstMutation` (token bucket) — bulk ops
- `adminRateLimitedMutation` (200/min) — admin panel
- `publicStrictMutation` (10/15min) — signup, login

**NEVER** use these in channel: `authenticatedMutation`, `adminMutation`, `publicMutation`

**Queries** use: `authenticatedQuery`, `adminQuery`, `publicQuery`

### Error Handling
```
throw new Error(...)           ❌ ALWAYS fails test
throw errors.notFound(...)     ✅
throw errors.forbidden(...)    ✅
throw errors.rateLimited(...)  ✅
```

### Cross-Domain Communication
```
ctx.db.query("subscriptions")  ❌ in users domain (cross-domain DB)
ctx.runQuery(internal.apps.payments.paymentsBusiness.check, {}) ✅
```

### Shared Infrastructure — MUST Use

| Need | Use | NOT |
|------|-----|-----|
| Multi-ID fetch | `getAll()` from lib/relationships | `Promise.all(ids.map(ctx.db.get))` |
| Counting | aggregate component | `.collect().length` |
| External API retry | `retrier.run()` from lib/retrier | `try/catch + scheduler` |
| Audit logging | `ctx.audit.log()` | `ctx.db.insert("auditLogs")` |
| File upload | `lib/storage.ts` helpers | direct `new S3Client()` |
| Email | `lib/email.ts` Resend instance | direct `new Resend()` |
| Webhook verify | `lib/webhook-verify.ts` | manual `crypto.subtle` |
| Rate limiting | lib/rate-limiter.ts instance | `new RateLimiter()` |
| Validators | `literals()`, `nullable()` | verbose `v.union(v.literal())` |

### Adding a New Domain
1. Create `convex/apps/{name}/`
2. Add files: `{name}.schema.ts`, `{name}.model.ts`, `{name}.business.ts`, `{name}.channel.ts`
3. Schema exports `{name}Tables` + field definitions
4. Add `...{name}Tables` to `convex/schema.ts`
5. Add `{name}Tables` to structural-integrity allowlist if needed
6. Run `npm run test:arch` — all tests must pass

## Frontend Rules

### Component Naming (ENFORCED)
File name → PascalCase must start with approved prefix:
`Button`, `Card`, `Dialog`, `Dropdown`, `Form`, `Input`, `Label`, `Select`, `Tabs`,
`Tooltip`, `Badge`, `Skeleton`, `Separator`, `Table`, `List`, `Nav`, `Navbar`,
`Sidebar`, `Layout`, `Grid`, `Section`, `Modal`, `Sheet`, `Alert`, `Progress`,
`Heading`, `Text`, `Image`, `Animate`, `Motion`, etc. (51+ types defined)

Each type has a max line limit (Button: 80, Dialog: 150, Table: 200, etc.)

### Component Rules
- **Named exports only** — no `export default`
- **No hardcoded hex colors** in className — use semantic tokens
- **Use `cn()`** for class merging
- **No `useState/useEffect`** in route files — delegate to features/hooks
- Route files max 100 lines

### Responsive Design (SCORED A-F)
Components are scored for responsive readiness. Score ≥ 60 (C) required.
- `w-[400px]+` without responsive variant → HIGH severity
- `grid-cols-3+` without responsive → HIGH severity
- Table without `overflow-x-auto` → HIGH severity
- Large text (4xl+) without responsive → MEDIUM
- Fixed absolute offsets ≥ 200px → MEDIUM

### Frontend Shared Utilities
| Need | Use |
|------|-----|
| Class merging | `cn()` from `app/lib/utils` |
| Forms | `useCherryForm()` from `app/lib/form` |
| Toast feedback | `withToast()` from `app/lib/toast` |
| Animations | presets from `app/lib/motion` (fadeIn, slideUp, etc.) |
| Convex hooks | `useQuery, useMutation` from `app/lib/convex` |
| Auth | `signIn, signUp, signOut` from `app/lib/auth-client` |
| SEO | `seoHead()` from `app/lib/seo` |
| Config | feature flags from `app/lib/config` |

## Structural Rules (Filesystem Firewall)

- `convex/` root: only `schema.ts`, `convex.config.ts`, `triggers.ts`, `http.ts`, `auth.ts`
- `convex/lib/`: flat, 19 approved modules only
- `convex/core/`: 4 approved modules (audit, parameter, schedule, webhook)
- `convex/apps/{domain}/`: flat, no subdirectories
- `app/` root: only `client.tsx`, `server.tsx`, `router.tsx`, `routeTree.gen.ts`
- `app/components/`: only `ui/`, `layout/`, `common/` subdirs
- `app/components/` root: only providers/wrappers

## Dependency Rules (dependency-cruiser)

- Domain A → Domain B direct import: **ERROR**
- core/ → apps/: **ERROR**
- lib/ → apps/ or core/: **ERROR**
- channel → business file: **WARN** (use internal API)
- channel → integration file: **ERROR**
- model → business/channel/integration: **ERROR**
- Circular dependencies: **ERROR**

## Quality Commands

```bash
npm run test:arch     # 826 architectural tests
npm run lint:deps     # Dependency rule violations
npm run lint:duplicates # Duplicate code detection (< 10%)
npm run check         # Full: tests + deps + typecheck
```

## Adding a New lib Module
1. Create `convex/lib/{name}.ts`
2. Add to `APPROVED_LIB_FILES` in `tests/structural-integrity.test.ts`
3. Add anti-pattern test in `tests/tech-adoption.test.ts` if applicable
4. Run tests

## Adding a New UI Component
1. Create `app/components/ui/{name}.tsx`
2. Name must match approved prefix (see component type registry)
3. Use CVA for variants, Radix for primitives, `cn()` for classes
4. Named exports only, no default export
5. Max lines per component type enforced
6. Run frontend architecture tests

## Adding a New Core Module
1. Create `convex/core/{name}/`
2. Add to `APPROVED_CORE_MODULES` in `tests/structural-integrity.test.ts`
3. Add `{name}.model.ts`, `{name}.business.ts`, `{name}.channel.ts`
4. Add table to `core.schema.ts`
