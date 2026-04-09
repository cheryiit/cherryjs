---
paths:
  - "convex/**/*.ts"
---

# Backend lib/ Reference (21 modules)

Complete catalog of `convex/lib/*` shared infrastructure. **Always check this list before writing utility code — it probably already exists.**

## Function Wrappers — `lib/functions.ts`

The middleware layer. ALL Convex function exports go through these.

```ts
import {
  publicQuery, publicMutation, publicAction,
  authenticatedQuery, adminQuery,
  strictMutation, normalMutation, relaxedMutation, burstMutation,
  adminRateLimitedMutation, publicStrictMutation,
  activeSystemMutation, verifiedUserMutation,
  internalAuthQuery, internalAuthMutation, internalAuthAction,
} from "../../lib/functions";
```

| Wrapper | Tier | Use For |
|---------|------|---------|
| `publicQuery` | none | Public read endpoints (landing data) |
| `publicMutation` | none | Internal use only — wrap with rate-limited variant in channel |
| `publicStrictMutation` | 10/15min IP | Signup, login, password reset |
| `authenticatedQuery` | auth required | Logged-in user reads |
| `strictMutation` | 5/min/user | Payments, account deletion, critical ops |
| `normalMutation` | 30/min/user | Standard CRUD |
| `relaxedMutation` | 100/min/user | Low-risk updates (preferences) |
| `burstMutation` | token bucket | Bulk imports |
| `adminQuery` | admin only | Admin panel reads |
| `adminRateLimitedMutation` | 200/min/admin | Admin panel writes |
| `activeSystemMutation` | maintenance check | Skip if maintenance mode |
| `verifiedUserMutation` | email verified | Actions requiring verified email |
| `internalAuth*` | internal | Cross-domain RPCs with auth context |

## Errors — `lib/errors.ts`

```ts
import { errors } from "../../lib/errors";

throw errors.notFound("User", userId);
throw errors.forbidden("Admin only");
throw errors.unauthenticated();
throw errors.alreadyExists("User", "email");
throw errors.validation("Invalid format", { field: "email" });
throw errors.rateLimited(retryAfterMs);
throw errors.maintenance();
throw errors.internal("DB write failed");
throw errors.custom("CUSTOM_CODE", "Message", { ...details });
```

## Audit — `lib/audit.ts`

Auto-injected as `ctx.audit` on authenticated wrappers. **Never insert into auditLogs directly.**

```ts
await ctx.audit.log({ action: "user.update", resourceType: "user", resourceId });
await ctx.audit.warn({ action: "auth.failed_login", details: { ip } });
await ctx.audit.critical({ action: "user.delete", resourceType: "user", resourceId });
```

## Rate Limiter — `lib/rateLimiter.ts`

Pre-built named tiers: `strict`, `normal`, `relaxed`, `burst`, `auth-ops`, `search-ops`, `file-upload`, `admin-ops`, `webhook-ingest`. **Don't create new RateLimiter instances** — use the wrapped mutations from `functions.ts`.

For domain-specific limits, add a new named tier in `lib/rateLimiter.ts`.

## Permissions — `lib/permissions.ts`

```ts
import { Role, Permission, hasPermission, canPerform } from "../../lib/permissions";

if (!canPerform(ctx.user, Permission.USER_DELETE)) throw errors.forbidden();
```

## Row-Level Security — `lib/rls.ts`

Wraps `ctx.db` to enforce per-document access rules. Use in business layer when documents have ownership.

```ts
import { withRls, withRlsWrite } from "../../lib/rls";

const rlsCtx = withRls(ctx); // wraps ctx.db with RLS rules
const userPosts = await rlsCtx.db.query("posts").collect(); // auto-filtered
```

Rules defined centrally in `lib/rls.ts` (`rlsRules` object).

## Validators — `lib/validators.ts`

```ts
import { literals, nullable, partial } from "../../lib/validators";

status: literals("active", "inactive", "pending"),  // shorter than v.union(v.literal(...))
email: nullable(v.string()),                         // v.union(v.string(), v.null())
updates: partial({ name: v.string(), email: v.string() }), // all optional
```

## Relationships — `lib/relationships.ts`

```ts
import { getAll, getAllOrThrow, getManyFrom, getManyVia } from "../../lib/relationships";

// Multi-ID fetch (instead of Promise.all + ctx.db.get)
const users = await getAll(ctx.db, userIds);
const usersOrFail = await getAllOrThrow(ctx.db, userIds);

// One-to-many via backref index
const posts = await getManyFrom(ctx.db, "posts", "by_author", authorId);

// Many-to-many via join table
const tags = await getManyVia(ctx.db, "post_tags", "tagId", "by_postId", postId);
```

## Filter — `lib/filter.ts`

JS predicates inside Convex queries (better than `.collect().filter()`).

```ts
import { filter } from "../../lib/filter";

const shortMessages = await filter(
  ctx.db.query("messages"),
  async (m) => m.body.length < 100,
).take(20);
```

## Migrations — `lib/migrations.ts`

Stateful batch migrations with auto-resume.

```ts
import { migration } from "../../lib/migrations";

export const addNewField = migration({
  table: "users",
  migrateOne: async (ctx, doc) => {
    await ctx.db.patch(doc._id, { newField: "default" });
  },
  batchSize: 50,
});
```

## Email — `lib/email.ts`

```ts
import { resend, FROM_EMAIL } from "../../lib/email";

await resend.sendEmail(ctx, FROM_EMAIL, toEmail, "Subject", htmlBody);
```

Use **only in `*.integration.ts` files** (action layer).

## Storage — `lib/storage.ts`

R2 presigned URLs. Use only in integration actions.

```ts
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteFile,
} from "../../lib/storage";

const uploadUrl = await generatePresignedUploadUrl(ctx, {
  bucket: process.env.R2_BUCKET!,
  key: `users/${userId}/avatar.png`,
  contentType: "image/png",
});
```

## Search — `lib/search.ts`

```ts
import { searchText } from "../../lib/search";

const matches = await searchText(ctx, "users", "search_name", query, 20);
```

## Webhook Verification — handled by Convex components

**Never write manual HMAC verification code.** Convex first-party
components handle webhook signature verification internally:

| Provider | Component | Mounted in `convex/lib/...` |
|----------|-----------|----------------------------|
| Polar (payments) | `@convex-dev/polar` | `lib/polar.ts` — `polar.registerRoutes(http)` |
| Better Auth | `@convex-dev/better-auth` | `convex/auth.ts` — `authComponent.registerRoutes(http, createAuth)` |
| Resend events | `@convex-dev/resend` | `lib/email.ts` — `onEmailEvent` callback |

For a webhook from a provider with no Convex component yet, write a thin
HTTP route in `convex/http.ts` that delegates verification to that
provider's official Node SDK (e.g. Stripe SDK has `constructEvent`).
Custom HMAC code is forbidden by the architectural test.

## Request Context — `lib/requestContext.ts`

```ts
import { extractIpFromRequest, parseLanguage } from "../../lib/requestContext";

const ip = extractIpFromRequest(c.req.raw);     // From Hono context
const lang = parseLanguage(acceptLanguageHeader);
```

`ctx.requestMeta` is auto-injected as `{ userAgent, language, timezone }` on authenticated wrappers.

## Retrier — `lib/retrier.ts`

Action retry with exponential backoff.

```ts
import { retrier } from "../../lib/retrier";

await retrier.run(ctx, internal.apps.payments.paymentsIntegration.callPolar, args);
```

Use in integration layer for unreliable external APIs.

## Workflow — `lib/workflow.ts`

Durable multi-step workflows with auto-resume on failure.

```ts
import { workflow } from "../../lib/workflow";

export const onboardingWorkflow = workflow.define({
  args: { userId: v.id("users") },
  handler: async (step, { userId }) => {
    await step.runMutation(internal.apps.users.usersBusiness.createProfile, { userId });
    await step.runAction(internal.apps.notifications.notificationsIntegration.sendWelcomeEmail, ...);
    await step.runMutation(internal.apps.users.usersBusiness.markOnboarded, { userId });
  },
});
```

## Sessions — `lib/sessions.ts`

Anonymous session tracking (carts, form drafts before signup).

```ts
import { vSessionId, SessionIdArg, type SessionId } from "../../lib/sessions";

export const addToCart = publicMutation({
  args: { ...SessionIdArg, productId: v.id("products") },
  handler: async (ctx, { sessionId, productId }) => { ... },
});
```

## CORS — `lib/cors.ts`

```ts
import { corsRouter } from "../../lib/cors";

const cors = corsRouter(http, { allowedOrigins: ["https://app.example.com"] });
```

## Settings — `lib/settings.ts`

Runtime config registry. Reads from `parameters` table with type safety.

```ts
import { settings } from "../../lib/settings";

const maintenance = await settings.getBoolean(ctx, "maintenance-mode", false);
const maxUpload = await settings.getNumber(ctx, "max-upload-size-mb", 10);
```

To add a setting: edit `SETTINGS_REGISTRY` in `lib/settings.ts` (or use `/add-setting` skill).

---

## Quick Decision Tree

```
Need to... → Use
─────────────────────────────────────────────
throw error          → errors.notFound() etc.
limit calls          → wrapped mutation (strict/normal/relaxed/burst)
log audit            → ctx.audit.log/warn/critical
check permission     → canPerform(ctx.user, Permission.X)
filter rows by user  → withRls(ctx)
fetch by IDs         → getAll() / getAllOrThrow()
filter with JS       → filter(query, predicate)
batch migration      → migration({...})
send email           → resend.sendEmail (integration only)
upload file          → generatePresignedUploadUrl (integration only)
search text          → searchText(ctx, table, index, query)
verify webhook       → Convex components (polar, betterAuth, resend)
extract IP/lang      → extractIpFromRequest / parseLanguage (Hono only)
retry external API   → retrier.run (integration only)
multi-step process   → workflow.define
anonymous session    → SessionIdArg + vSessionId
allow CORS           → corsRouter
read runtime config  → settings.getNumber/getBoolean/getString
union literals       → literals("a", "b", "c")
nullable validator   → nullable(v.string())
optional fields obj  → partial({...})
```
