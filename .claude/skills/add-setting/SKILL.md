---
name: add-setting
description: Register a new runtime setting (parameter) in lib/settings.ts SETTINGS_REGISTRY with proper scope, type, and default
---

Add a new setting called `$ARGUMENTS` (format: `scope.key` e.g. `withdraw.dailyLimit`).

## Steps

1. **Pick the right scope.** Open `convex/lib/settings.ts` and look at `SETTINGS_REGISTRY`. Existing scopes:
   - `system` — global app config (maintenanceMode, maxUploadSizeMb, signupsEnabled)
   - `feature` — feature flags (kebab-case keys recommended)
   - `rateLimit` — runtime rate limit overrides
   - Add a new scope only if the setting doesn't fit existing scopes (e.g. `withdraw`, `email`, `notifications`)

2. **Add the entry to `SETTINGS_REGISTRY`** in `convex/lib/settings.ts`:
   ```ts
   {scope}: {
     {key}: {
       type: "boolean" | "number" | "string",
       default: <default value>,
       description: "What this setting does + when changing it matters",
     },
   }
   ```
   - `type` MUST be one of `"boolean"`, `"number"`, `"string"` (no objects/arrays — those go in dedicated tables)
   - `default` MUST match the type literally
   - `description` is mandatory and shown in admin UI

3. **If you added a new scope**, also add it to the `SettingScope` type — this is automatic via `keyof typeof SETTINGS_REGISTRY`, but verify TypeScript doesn't complain.

4. **Read the setting in business/model layer** (NEVER in channel handlers directly):
   ```ts
   import { settings } from "../../lib/settings";

   const limit = await settings.getNumber(ctx, "withdraw", "dailyLimit");
   const enabled = await settings.getBoolean(ctx, "feature", "newCheckout");
   const required = await settings.requireString(ctx, "system", "polarApiKey"); // throws if missing
   ```
   - `getNumber/Boolean/String` always return a value (default fallback)
   - `requireString` throws `errors.internal` if missing — use only for truly required config (API keys)
   - `getRaw` returns the raw stored value or null

5. **Seed the default if it should be in the DB on first deploy.** Edit `convex/core/parameter/parameterBusiness.ts` `seed` mutation and add the entry. This is OPTIONAL — `getNumber/Boolean/String` already fall back to the registry default if the row doesn't exist. Only seed if you want it visible in admin UI immediately.

6. **DO NOT create a new channel mutation to set this value.** All settings are written through the existing `core.parameter.parameterChannel.set` (admin-only, audit logged, rate limited). To change a setting from code, call:
   ```ts
   await ctx.runMutation(internal.core.parameter.parameterBusiness.set, {
     domain: "withdraw",
     key: "dailyLimit",
     value: 5000,
     updatedBy: ctx.user._id,
   });
   ```

7. **Run `npm run test:arch`** — verify the lib still passes (no new violations).

## Forbidden Patterns

| ❌ DON'T | ✅ DO |
|----------|-------|
| Hardcode magic numbers in business logic (`if (amount > 1000)`) | `await settings.getNumber(ctx, "withdraw", "dailyLimit")` |
| Read parameters table directly (`ctx.db.query("parameters")`) | Use `settings.*` helpers from `lib/settings.ts` |
| Create new mutation just to set one parameter | Use `core.parameter.parameterChannel.set` |
| Skip the registry "to save time" | Always register — registry IS the documentation |
| Use objects/arrays as setting values | Use multiple scalar settings or a dedicated table |
| Add a setting with no description | Description is mandatory — explain *why*, not *what* |

## Why This Matters

Settings are runtime-mutable configuration that admins can change without a deploy. They are stored in the `parameters` table, which is shared across all environments. The registry serves three purposes:

1. **Documentation** — AI agents (and humans) know what settings exist without grepping
2. **Type safety** — TypeScript knows the scope and default type
3. **Default fallback** — if the row is missing in the DB (e.g. new env, fresh deploy), the registry default is used so nothing breaks

Without the registry, settings become "magic strings" scattered across the codebase, and removing or renaming one becomes impossible.

See `.claude/rules/settings-parameters.md` for the full rule reference.
