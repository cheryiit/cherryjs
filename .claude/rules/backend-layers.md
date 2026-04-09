---
paths:
  - "convex/**/*.ts"
---

# Backend Layer Rules

## File Naming
Every file in `apps/{domain}/` MUST be `{domain}{Layer}.ts`.
Approved layers: channel, business, integration, model, schema, schedule, batch, test

## Layer Responsibilities

| Layer | Builder | Purpose | DB Access |
|-------|---------|---------|-----------|
| channel | Rate-limited wrappers | Public API, delegate to business, audit | Via runMutation/runQuery |
| business | internalMutation/Query | ALL business logic | Direct ctx.db |
| integration | internalAction | External APIs (fetch) | NO ctx.db — use runMutation |
| model | Pure functions | DB read helpers, return null not throw | Direct ctx.db (read only) |
| schema | — | Table definitions | — |

## Channel Mutation Wrappers

MUST use rate-limited wrappers:
- `strictMutation` (5/min) — payments, critical ops
- `normalMutation` (30/min) — standard CRUD
- `relaxedMutation` (100/min) — low-risk updates
- `burstMutation` (token bucket) — bulk operations
- `adminRateLimitedMutation` (200/min) — admin panel
- `publicStrictMutation` (10/15min) — public auth ops

NEVER use in channel: `authenticatedMutation`, `adminMutation`, `publicMutation`
Query wrappers: `authenticatedQuery`, `adminQuery`, `publicQuery`

## Model Layer Rules
- Function names: `get*`, `list*`, `exists*`, `count*`, `find*`
- Return `null` for not found — never throw
- No Convex builders (no `internalMutation(...)` etc.)
- No business logic, no auth checks

## Integration Layer Rules
- Only `internalAction` exports
- `fetch()` ONLY allowed here
- No `ctx.db` — write via `ctx.runMutation(internal...)`
- Use `retrier.run()` for unreliable APIs

## Shared Infrastructure (lib/) — 20 modules

See `.claude/rules/backend-lib-reference.md` for the full catalog with imports, signatures, and decision tree. Quick list:

`functions`, `errors`, `rateLimiter`, `audit`, `permissions`, `rls`, `validators`,
`relationships`, `filter`, `migrations`, `email`, `storage`, `polar`, `search`,
`requestContext`, `retrier`, `workflow`, `sessions`, `cors`, `settings`

## Domain Layer Suffixes

Each `convex/apps/{domain}/` directory may contain (camelCase only):

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Schema.ts` | Table definitions, Fields exports | `usersSchema.ts` |
| `Model.ts` | Pure DB read helpers (no builders) | `usersModel.ts` |
| `Business.ts` | Internal mutations/queries (businessMutation/Query) | `usersBusiness.ts` |
| `Channel.ts` | Public API surface (rate-limited wrappers) | `usersChannel.ts` |
| `Integration.ts` | External API actions (`fetch()` allowed) | `paymentsIntegration.ts` |
| `Workflow.ts` | Multi-step durable orchestrations via @convex-dev/workflow | `inAppNotificationsWorkflow.ts` |

**Always check the reference before writing utility code — it probably already exists.**
