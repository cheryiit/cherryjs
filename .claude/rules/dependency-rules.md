---
paths:
  - "convex/**/*.ts"
  - "app/**/*.ts"
  - "app/**/*.tsx"
---

# Dependency and Isolation Rules

Enforced by dependency-cruiser + structural-integrity tests.

## Domain Isolation
- `apps/users/` -> `apps/payments/` direct import: ERROR
- Cross-domain communication: use `ctx.runQuery(internal.apps.{domain}.{module}.fn, {})`
- Cross-domain DB access: `ctx.db.query("other_domain_table")` -> ERROR

## Layer Direction
```
lib/       -> nothing (standalone)
core/      -> lib/ only (never apps/)
apps/      -> lib/ + _generated/api (never other apps/ directly)
```

## Layer Import Rules
- channel -> business file import: WARN (use internal API)
- channel -> integration file: ERROR
- model -> business/channel/integration: ERROR
- Circular dependencies: ERROR

## Frontend
- components/ui/ -> convex internals: WARN (use hooks)
- routes/ -> convex business: WARN (delegate to features)

## Structural Firewall (approved locations only)
- convex/ root: schema.ts, convex.config.ts, triggers.ts, http.ts, auth.ts
- convex/lib/: 19 named modules only (flat)
- convex/core/: 4 named modules (audit, parameter, schedule, webhook)
- convex/apps/{domain}/: flat, {domain}{Layer}.ts naming
- app/ root: client.tsx, server.tsx, router.tsx, routeTree.gen.ts
- app/components/: ui/, layout/, common/ subdirs only
