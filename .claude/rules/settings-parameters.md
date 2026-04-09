---
paths:
  - "convex/lib/settings.ts"
  - "convex/core/parameter/**"
  - "convex/**/*.business.ts"
  - "convex/**/*.model.ts"
---

# Settings & Parameters

Runtime-mutable configuration that admins can change without a deploy.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  parameters table (coreSchema.ts)                      │
│  { domain, key, value, description, updatedBy, ... }    │
└────────────────────┬────────────────────────────────────┘
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
┌──────────────────┐    ┌────────────────────────────┐
│ lib/settings.ts  │    │ core/parameter/            │
│ (READ helpers)   │    │ - parameterModel.ts (read)│
│ - getNumber      │    │ - parameterBusiness.ts    │
│ - getBoolean     │    │ - parameterChannel.ts     │
│ - getString      │    │   (admin-only writes)      │
│ - requireString  │    └────────────────────────────┘
│ - getRaw         │
│ - SETTINGS_REGISTRY (source of truth)
└──────────────────┘
```

**Two consumers, one table:**
- `lib/settings.ts` — type-safe read API used by business/model code
- `core/parameter/` — admin CRUD endpoints exposed via channel layer

## The Registry (Source of Truth)

`SETTINGS_REGISTRY` in `convex/lib/settings.ts` is the **only place** new settings should be declared. It's a literal `as const` object that powers TypeScript autocomplete, defaults, and admin UI metadata.

```ts
export const SETTINGS_REGISTRY = {
  system: {
    maintenanceMode: { type: "boolean", default: false, description: "..." },
    maxUploadSizeMb: { type: "number", default: 10, description: "..." },
  },
  feature: {
    waitlistMode: { type: "boolean", default: false, description: "..." },
  },
} as const;
```

**Rules:**
1. Every setting MUST be in the registry — no ad-hoc keys
2. Type MUST be one of `"boolean" | "number" | "string"` (no objects/arrays)
3. `default` MUST literally match the type
4. `description` is mandatory — explain why this setting exists, not what it does
5. Scope names should be kebab-friendly (no spaces, no dots)

## Reading Settings

ALWAYS go through `lib/settings.ts` helpers. NEVER query the parameters table directly.

```ts
import { settings } from "../../lib/settings";

// Most common — typed read with default fallback
const limit = await settings.getNumber(ctx, "withdraw", "dailyLimit");
const enabled = await settings.getBoolean(ctx, "feature", "newCheckout");
const message = await settings.getString(ctx, "system", "maintenanceMessage");

// Required setting — throws if missing/empty (use for API keys)
const apiKey = await settings.requireString(ctx, "integrations", "polarApiKey");

// Raw read (escape hatch)
const raw = await settings.getRaw(ctx, "system", "experimentalConfig");
```

**Where reads belong:**
- ✅ `*.business.ts` — yes, business logic reads config
- ✅ `*.model.ts` — yes, helpers may read config
- ✅ `*.integration.ts` — yes, integrations read API keys
- ❌ `*.channel.ts` — NO. Channel handlers should be max 20 lines and pass to business. Read settings inside the business mutation.

## Writing Settings

There is exactly **one** way to write settings: `core.parameter.parameterChannel.set` — admin-only, audit logged, rate limited.

```ts
// From admin code (e.g. another channel calling for migration)
await ctx.runMutation(internal.core.parameter.parameterBusiness.set, {
  domain: "withdraw",
  key: "dailyLimit",
  value: 5000,
  description: "Per-user daily withdrawal limit in USD",
  updatedBy: ctx.user._id,
});
```

**DO NOT** create a per-domain "settings update" mutation. There is one centralized writer for a reason: every settings change is audited under `parameter.set` action, every change rate limited under `admin-ops`.

## Seeding Defaults

If a setting needs to exist in the DB on first deploy (e.g. visible in admin UI without manual creation), add it to the `seed` mutation in `convex/core/parameter/parameterBusiness.ts`:

```ts
const defaults = [
  { key: "maintenance-mode", value: false, description: "..." },
  { key: "your-new-setting", value: 100, domain: "yourScope", description: "..." },
];
```

This is OPTIONAL. The registry defaults already kick in when reading a missing setting. Only seed if admin UI visibility is required immediately.

## Settings vs Tables — When to Use Which

| Use a Setting | Use a Dedicated Table |
|---------------|----------------------|
| Single scalar value (number, bool, string) | Multiple records, structured data |
| Changes infrequently (operational config) | High write volume |
| Read-by-key pattern | Queried with filters/joins |
| ~30 settings per project max | Unlimited rows |
| Examples: rate limits, feature flags, maintenance mode | Examples: user preferences, content, products |

If you need to store user-specific overrides, that's NOT a setting — that's a `userPreferences` table inside the user domain.

## The Core Parameter Channel — Extra Sensitive

`parameterChannel.ts` writes use `/** @admin @critical */` markers. This means:
- Only admins can call them
- Every call is audited (`parameter.set`, `parameter.delete`)
- Rate limited under `admin-ops` (200/min)
- Architectural test enforces all of the above

If you ever need to bypass these guards (you almost certainly do not), think very carefully and use `// cherry:allow` with a justification comment.

## Adding a New Setting (Quick Reference)

```ts
// 1. convex/lib/settings.ts — add to SETTINGS_REGISTRY
withdraw: {
  dailyLimit: {
    type: "number",
    default: 1000,
    description: "Per-user daily withdrawal cap (USD). Increase only after fraud review.",
  },
},

// 2. Use it in business layer
const limit = await settings.getNumber(ctx, "withdraw", "dailyLimit");
if (amount > limit) throw errors.validation("Exceeds daily limit");

// 3. (Optional) Seed default in core/parameter/parameterBusiness.ts seed mutation

// 4. npm run test:arch
```

That's it. No new files, no new tables, no new mutations.
