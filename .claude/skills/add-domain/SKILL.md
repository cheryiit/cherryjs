---
name: add-domain
description: Scaffold a new Convex business domain with schema, model, business, and channel files
---

Create a new business domain called `$ARGUMENTS`.

1. Create `convex/apps/$ARGUMENTS/` directory
2. Create `$ARGUMENTS.schema.ts`: export `${name}Fields` and `${name}Tables` with defineTable + indexes
3. Create `$ARGUMENTS.model.ts`: pure query helpers (get*, list*, find*, exists*), return null not throw, type-only imports
4. Create `$ARGUMENTS.business.ts`: internalMutation/Query only, use errors.* for throws, import model helpers
5. Create `$ARGUMENTS.channel.ts`: rate-limited wrappers only (normalMutation, strictMutation, etc.), delegate to business via ctx.runMutation/runQuery, add ctx.audit.log()
6. Add `...${name}Tables` spread to `convex/schema.ts`
7. If external API needed: create `$ARGUMENTS.integration.ts` with internalAction only, fetch() allowed here
8. Run `npm run test:arch` — fix any violations

Reference existing domains: `convex/apps/users/`, `convex/apps/payments/`
