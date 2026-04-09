# CherryJS Architecture

Production framework for AI-driven development on Convex + TanStack Start.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE WORKERS                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ TanStack Start v2 (SSR + CSR)                                │  │
│  │  app/routes/       → file-based pages                        │  │
│  │  app/features/     → business UI modules                     │  │
│  │  app/components/   → ui/ (Radix+CVA) + layout/ (Navbar...)   │  │
│  │  app/lib/          → hooks, utils, auth, forms, toast, seo   │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS (websocket for real-time queries)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CONVEX CLOUD                                │
│                                                                     │
│  ┌── convex.config.ts ──────────────────────────────────────────┐   │
│  │ Components (isolated namespaces):                            │   │
│  │  betterAuth  rateLimiter  aggregate  actionRetrier           │   │
│  │  resend      workflow     polar      r2                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── schema.ts (aggregator) ────────────────────────────────────┐   │
│  │ ...coreTables, ...usersTables, ...waitlistTables,            │   │
│  │ ...notificationsTables, ...inAppNotificationsTables,         │   │
│  │ ...paymentsTables (empty — Polar component owns billing)     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── lib/ (20 modules — standalone, no apps/core imports) ──────┐   │
│  │ functions.ts   errors.ts    audit.ts     permissions.ts      │   │
│  │ rateLimiter.ts settings.ts  polar.ts     storage.ts (R2)     │   │
│  │ email.ts       workflow.ts  aggregate.ts validators.ts       │   │
│  │ relationships.ts filter.ts  migrations.ts retrier.ts         │   │
│  │ rls.ts         search.ts    sessions.ts  cors.ts             │   │
│  │ requestContext.ts                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── core/ (5 infra modules) ───────────────────────────────────┐   │
│  │ audit/       → auditBusiness, auditChannel, auditModel       │   │
│  │ parameter/   → parameterBusiness, parameterChannel, ...Model │   │
│  │ content/     → contentBusiness, contentChannel, ...Model     │   │
│  │ schedule/    → scheduleBusiness, scheduleChannel, ...Model   │   │
│  │ webhook/     → webhookBusiness, webhookModel                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── apps/ (5 business domains + _template) ────────────────────┐   │
│  │ users/          → auth user profiles, roles, admin ops       │   │
│  │ payments/       → Polar component wrapper (thin channel)     │   │
│  │ waitlist/       → pre-launch email collection                │   │
│  │ notifications/  → outbound email logs (Resend)               │   │
│  │ inAppNotifications/ → bell-icon feed, multi-channel workflow │   │
│  │ _template/      → scaffolding reference (copy for new domain)│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── HTTP (auth.ts + http.ts + triggers.ts) ────────────────────┐   │
│  │ auth.ts      → Better Auth 0.11 (createClient + triggers)   │   │
│  │ http.ts      → Hono router: health, auth routes, Polar wh   │   │
│  │ triggers.ts  → DB triggers (user role change → audit log)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Architecture

Every domain (`apps/{domain}/`) follows the same 6-layer pattern:

```
                Public API (frontend calls this)
                       │
              ┌────────▼─────────┐
              │   *Channel.ts    │  Rate-limited wrappers, auth, audit
              │  (max 200 lines) │  Delegates to Business via runMutation
              └────────┬─────────┘
                       │ ctx.runMutation / ctx.runQuery
              ┌────────▼─────────┐
              │  *Business.ts    │  ALL business logic lives here
              │ (businessMutation│  Direct ctx.db access
              │  /businessQuery) │  Imports Model helpers for reads
              └────────┬─────────┘
                       │ function call (not runMutation)
              ┌────────▼─────────┐
              │   *Model.ts      │  Pure DB read helpers
              │  (no builders)   │  get*, list*, find*, exists*, count*
              │                  │  Returns null, never throws
              └──────────────────┘

              ┌──────────────────┐
              │*Integration.ts   │  External API calls (fetch() allowed)
              │ (businessAction) │  NO ctx.db — only runMutation/runQuery
              └──────────────────┘

              ┌──────────────────┐
              │ *Workflow.ts     │  Multi-step durable orchestrations
              │ (workflow.define)│  @convex-dev/workflow component
              └──────────────────┘

              ┌──────────────────┐
              │  *Schema.ts      │  defineTable + indexes + Fields export
              └──────────────────┘
```

## Dependency Direction (enforced)

```
lib/       → nothing (standalone)
core/      → lib/ only
apps/      → lib/ + _generated/api (never other apps/ directly)
channel    → lib/functions wrappers (never raw internalMutation)
model      → nothing (no business, no channel, no integration)
app/       → app/lib/ (not convex/ directly in components)
```

## Component Model

Convex components are NPM packages mounted via `convex.config.ts`:

```ts
import polar from "@convex-dev/polar/convex.config";
app.use(polar);  // → dashboard: "polar" node
```

Each component owns **isolated tables** in its own namespace. App code
cannot `ctx.db.query("component_table")` — must use the component's
typed API (`polar.getCurrentSubscription(ctx, { userId })`).

Component instances live in `convex/lib/`:
- `lib/polar.ts` → Polar payments
- `lib/storage.ts` → R2 file storage
- `lib/email.ts` → Resend email

## Auth Flow

```
Browser → Better Auth sign-in UI
  → POST /api/auth/sign-in (Convex HTTP endpoint)
    → Better Auth validates credentials
    → Issues JWT (subject = BA user id)
    → Trigger: user.onCreate → insert app `users` row
  → Frontend receives session token
  → Convex websocket authenticated via JWT
  → Every query: resolveCurrentUser(ctx) → users.by_auth_id index
```

## Notification Fan-Out

```
Channel: sendNotification(userId, channels: ["in-app", "email"])
  → Workflow: notificationFanout
    Step 1 (inline mutation): insert inAppNotifications row
      → Frontend bell badge updates over websocket instantly
    Step 2 (inline query): lookup user email
    Step 3 (action, retry): send email via Resend component
    Step 4 (inline mutation): patch row with emailMessageId
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Architectural Tests (1300+)                                 │
│  backend/architecture     → naming, size, imports, layers   │
│  backend/enforcement      → anti-patterns, rate limits      │
│  backend/tech-adoption    → use framework helpers            │
│  backend/admin-security   → @admin markers, role sync       │
│  backend/lib-integrity    → lib exports, wrapper sync       │
│  frontend/architecture    → component naming, exports       │
│  frontend/design-tokens   → no arbitrary colors             │
│  frontend/responsive      → responsive scoring A-F          │
│  structural-integrity     → filesystem firewall             │
│  code-quality             → dependency-cruiser, jscpd       │
├─────────────────────────────────────────────────────────────┤
│ ESLint (@convex-dev/eslint-plugin)                          │
│  require-args-validator   → every function needs args       │
│  explicit-table-ids       → v.id("table") not v.string()   │
│  no-old-syntax            → object not positional args      │
│  no-collect-in-query      → perf foot-gun detection         │
├─────────────────────────────────────────────────────────────┤
│ TypeScript (tsc --noEmit)                                   │
│  Full strict mode, 0 errors                                 │
├─────────────────────────────────────────────────────────────┤
│ Dependency-cruiser                                          │
│  Cross-domain isolation, circular deps, layer direction     │
└─────────────────────────────────────────────────────────────┘
```

## File Naming Convention

**Convex bundler silently skips files with multiple dots.** All files
under `convex/` MUST use single-dot camelCase:

| Pattern | Example |
|---------|---------|
| `{domain}{Layer}.ts` | `usersBusiness.ts`, `paymentsChannel.ts` |
| `{module}{Layer}.ts` | `auditModel.ts`, `contentChannel.ts` |
| `coreSchema.ts` | Single core schema aggregator |

NEVER: `users.business.ts` — Convex drops it silently.

## Quick Reference: npm Scripts

```bash
npm run check            # Full pipeline: arch + deps + duplicates + convex lint + typecheck
npm run test:arch        # 1300+ architectural tests
npm run lint:convex      # @convex-dev/eslint-plugin
npm run lint:deps        # dependency-cruiser
npm run lint:duplicates  # jscpd (<10% threshold)
npm run typecheck        # tsc --noEmit
npm run convex:dev       # Convex backend (hot-push on save)
npm run dev              # Vite frontend (localhost:3000)
```
