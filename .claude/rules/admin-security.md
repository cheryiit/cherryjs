---
paths:
  - "convex/**/*.ts"
---

# Admin Security & Authorization

This document defines how authorization works in CherryJS. **Read this before writing any channel mutation.**

## Roles

Defined in `convex/lib/permissions.ts` and `convex/apps/users/usersSchema.ts` (both must stay in sync — enforced by test):

| Role | Description |
|------|-------------|
| `admin` | Full system access — all permissions |
| `user` | Regular user — read/update self only |

To add a new role: edit BOTH files, then run `npm run test:arch`.

## Authorization Tiers (channel layer)

Channel files MUST use one of these wrappers. NEVER use raw `mutation()` or `query()`.

| Wrapper | Auth | Rate Limit | Use For |
|---------|------|------------|---------|
| `publicQuery` | None | None | Public reads (content, marketing pages) |
| `publicStrictMutation` | None | 10/15min IP | Signup, login, password reset |
| `authenticatedQuery` | User | None | Reads requiring login |
| `relaxedMutation` | User | 100/min | Low-risk updates (preferences) |
| `normalMutation` | User | 30/min | Standard CRUD |
| `strictMutation` | User | 5/min | Payments, account deletion |
| `burstMutation` | User | Token bucket | Bulk operations |
| `verifiedUserMutation` | User + email verified | 30/min | Trust-required actions |
| **`adminQuery`** | **Admin only** | None | **Admin reads** |
| **`adminRateLimitedMutation`** | **Admin only** | 200/min | **Admin writes** |

**FORBIDDEN in channel files:** `authenticatedMutation`, `adminMutation`, `publicMutation` (these are base wrappers — must be wrapped with rate limiting).

## The @admin Marker (CRITICAL)

To prevent AI from accidentally exposing admin-only operations to regular users, mark every admin export with a JSDoc comment:

```ts
/** @admin */
export const listAllUsers = adminQuery({
  args: {},
  handler: async (ctx) => { /* ... */ },
});

/** @admin */
export const banUser = adminRateLimitedMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // implementation
    await ctx.audit.warn({ action: "user.ban", resourceType: "user", resourceId: userId });
  },
});
```

**Architectural test enforces:** any export marked `@admin` MUST use `adminQuery`, `adminMutation`, or `adminRateLimitedMutation`. If you mark `@admin` but write `normalMutation`, the test fails.

## The @critical Marker

For the most sensitive operations (payments, deletes, parameter changes):

```ts
/** @admin @critical */
export const deleteUser = adminRateLimitedMutation({ /* ... */ });
```

`@critical` enforces use of `strictMutation` or `adminRateLimitedMutation` (the rate-limit-strict tiers).

## Mandatory Audit Logging

**Every `adminRateLimitedMutation` MUST call `ctx.audit.log`, `ctx.audit.warn`, or `ctx.audit.critical`** in its handler. This is enforced by test.

```ts
/** @admin */
export const updateRole = adminRateLimitedMutation({
  args: { userId: v.id("users"), role: v.string() },
  handler: async (ctx, { userId, role }) => {
    await ctx.runMutation(internal.apps.users.usersBusiness.updateRole, {
      userId,
      role,
    });

    // REQUIRED — without this, the test fails
    await ctx.audit.warn({
      action: "user.updateRole",
      resourceType: "user",
      resourceId: userId,
      details: { newRole: role },
    });
  },
});
```

If you genuinely need an admin mutation without audit (e.g., a no-op health check), add `// cherry:allow-no-audit` inside the handler.

## Layer Restrictions

| Layer | Can use admin wrappers? |
|-------|------------------------|
| `*.channel.ts` | YES |
| `*.business.ts` | NO (use `internalMutation/Query`) |
| `*.model.ts` | NO (no builders at all) |
| `*.integration.ts` | NO (only `internalAction`) |

This is enforced — admin wrappers outside channel layer fail the test.

## Settings & Parameters

Use `lib/settings.ts` for type-safe reads:

```ts
import { settings } from "../../lib/settings";

const limit = await settings.getNumber(ctx, "withdraw", "dailyLimit", 1000);
const enabled = await settings.getBoolean(ctx, "feature", "newCheckout");
```

**To register a new setting:** add it to `SETTINGS_REGISTRY` in `lib/settings.ts`. Do not invent new scopes ad-hoc.

**To set/update a setting from code:** call `internal.core.parameter.parameterBusiness.set` (admin-only at the channel level).

## Content / CMS

Editable page content (terms, FAQ, marketing) lives in `core/content/`:
- `core.content.contentChannel.getPublished` — public read by slug
- `core.content.contentChannel.upsert` — admin write
- `core.content.contentChannel.setStatus` — admin status change
- `core.content.contentChannel.remove` — admin delete (use `setStatus("archived")` instead when possible)

## How AI Should Approach New Channel Mutations

Before writing any channel mutation, ask:

1. **Is this for admins only?** → Use `adminRateLimitedMutation` + `/** @admin */` marker + `ctx.audit.log`
2. **Is this destructive or sensitive?** → Add `@critical` to the marker
3. **Is this for unauthenticated users?** → Use `publicStrictMutation`
4. **Is this a read?** → Use `publicQuery`, `authenticatedQuery`, or `adminQuery` (with `@admin` if admin)
5. **Otherwise** → Use `normalMutation` for standard CRUD

When in doubt, prefer the more restrictive tier. The rate-limit cost is negligible; the security cost of choosing wrong is catastrophic.
