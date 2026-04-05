# Custom Functions — Convex Middleware Pattern

Kaynak: https://stack.convex.dev/custom-functions
GitHub: https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/customFunctions.ts

## Neden Gerekli?

Convex'te her public fonksiyona auth check, rate limit, logging yazmak kod tekrarına yol açar.
`customQuery/Mutation/Action` bunları **tek yerde** tanımlayıp reuse etmeyi sağlar.

**3 Temel Prensip:**
1. **Obvious & Discoverable** — `Cmd+Click` ile middleware koduna git
2. **Explicit & Direct** — Nested wrapper yok, imperative flow
3. **Type Safe** — ctx.user gibi ekstra alanlar handler'da tam type-safe

---

## Exported API

```typescript
import {
  customQuery,      // query/internalQuery wrapper
  customMutation,   // mutation/internalMutation wrapper
  customAction,     // action/internalAction wrapper
  customCtx,        // sadece ctx değiştir
  customCtxAndArgs, // ctx + args değiştir
  NoOp,             // identity (değişiklik yok)
} from "convex-helpers/server/customFunctions";
```

---

## Temel Yapı — input Fonksiyonu

```typescript
const builder = customMutation(mutation, {
  args: {
    // Bu argümanlar her çağrıda consume edilir
    // Handler'a geçmez (veya geçirmek istersen geçirebilirsin)
  },
  input: async (ctx, args) => {
    // args: yukarıdaki args objesine gore type-safe
    // ctx: original MutationCtx

    // Yeni ctx döndür (eklenecek alanlarla)
    return {
      ctx: { ...ctx, user: await getUser(ctx) },
      args: {},        // Handler'a geçecek ekstra argümanlar
      // onSuccess?: () => Promise<void>  // Opsiyonel
    };
  },
});
```

---

## Framework için Tam Kurulum

```typescript
// convex/lib/functions.ts
import {
  customQuery,
  customMutation,
  customAction,
  customCtx,
} from "convex-helpers/server/customFunctions";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { ConvexError } from "convex/values";
import { getCurrentUser } from "../model/users";
import { rateLimiter } from "./rateLimiter";

// ─── Public Wrappers ───────────────────────────────────────────

/** Auth gerektirmeyen public query */
export const publicQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

/** Auth gerektirmeyen public mutation */
export const publicMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

/** Oturum açmış kullanıcı gerektirir — ctx.user mevcut */
export const authenticatedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/** Oturum açmış kullanıcı gerektirir — ctx.user mevcut */
export const authenticatedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/** Admin rolü gerektirir — ctx.user mevcut */
export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (user.role !== "admin")
      throw new ConvexError({ code: "UNAUTHORIZED", requiredRole: "admin" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/** Admin rolü gerektirir */
export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (user.role !== "admin")
      throw new ConvexError({ code: "UNAUTHORIZED", requiredRole: "admin" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

// ─── Internal Wrappers ─────────────────────────────────────────

/** Internal query — sadece backend'den çağrılabilir */
export const internalAuthQuery = customQuery(internalQuery, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/** Internal mutation — sadece backend'den çağrılabilir */
export const internalAuthMutation = customMutation(internalMutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

// ─── Rate Limited Wrappers ─────────────────────────────────────

/** API rate limiting ile authenticated mutation */
export const rateLimitedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });

    const { ok, retryAfter } = await rateLimiter.limit(ctx, "api", {
      key: user._id,
      throws: false,
    });
    if (!ok) {
      throw new ConvexError({ code: "RATE_LIMITED", retryAfter });
    }

    return { ctx: { ...ctx, user }, args: {} };
  },
});
```

---

## Kullanım

```typescript
// convex/functions/posts.ts
import {
  publicQuery,
  authenticatedQuery,
  authenticatedMutation,
  adminMutation,
} from "../lib/functions";
import { v } from "convex/values";

// ctx.user otomatik - type-safe
export const getMyPosts = authenticatedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20 }) => {
    return ctx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", ctx.user._id))
      .take(limit);
  },
});

export const createPost = authenticatedMutation({
  args: {
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { title, body, tags }) => {
    return ctx.db.insert("posts", {
      title,
      body,
      tags: tags ?? [],
      authorId: ctx.user._id,
      status: "draft",
    });
  },
});

export const getPublicPosts = publicQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    return ctx.db
      .query("posts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .paginate({ cursor: cursor ?? null, numItems: 20 });
  },
});

export const deleteAnyPost = adminMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await ctx.db.delete("posts", postId);
  },
});
```

---

## Argüman Tüketme (Consume)

Middleware seviyesinde argümanı handler'a **geçirmeden** işle:

```typescript
// API key argümanı consume et
export const apiKeyMutation = customMutation(mutation, {
  args: { apiKey: v.string() },
  input: async (ctx, { apiKey }) => {
    const isValid = await validateApiKey(ctx, apiKey);
    if (!isValid) throw new ConvexError({ code: "UNAUTHORIZED" });

    // apiKey handler'a geçmez — args: {} boş
    return { ctx, args: {} };
  },
});

// Kullanım — handler apiKey'i bilmiyor
export const createResource = apiKeyMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return ctx.db.insert("resources", { name });
  },
});
```

---

## onSuccess Callback

Mutation başarıyla tamamlandıktan sonra çalışır:

```typescript
export const auditedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });

    return {
      ctx: { ...ctx, user },
      args: {},
      onSuccess: async () => {
        // Mutation commit'ten SONRA çalışır
        // Audit log, notification, analytics için idealdir
        await ctx.db.insert("auditLogs", {
          userId: user._id,
          action: "mutation_success",
          timestamp: Date.now(),
        });
      },
    };
  },
});
```

---

## customCtx — Sadece ctx Değiştir

Input/output argümanları değiştirmeyip sadece ctx zenginleştirmek için kısayol:

```typescript
import { customCtx } from "convex-helpers/server/customFunctions";

// Triggers ile kullanım (triggers.ts'de wrapDB için)
export const mutation = customMutation(
  rawMutation,
  customCtx((ctx) => triggers.wrapDB(ctx))
);
```

---

## customCtxAndArgs — ctx + args

```typescript
import { customCtxAndArgs } from "convex-helpers/server/customFunctions";

// ctx + args birlikte değiştir
const withTenant = customCtxAndArgs(
  async (ctx: QueryCtx, args: { tenantId: string }) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_id", (q) => q.eq("tenantId", args.tenantId))
      .unique();

    // tenantId'yi consume et, ctx'e tenant ekle
    const { tenantId, ...rest } = args;
    return { ctx: { ...ctx, tenant }, args: rest };
  }
);
```

---

## TypeScript Tipleri

ctx.user tam type-safe çalışır:

```typescript
import type { Doc } from "../_generated/dataModel";

// Bu tipi export edersen başka yerlerde de kullanabilirsin
type AuthenticatedCtx = Awaited<ReturnType<typeof authenticatedMutation["_input"]>>["ctx"];

// Handler içinde:
export const updateProfile = authenticatedMutation({
  args: { bio: v.string() },
  handler: async (ctx, { bio }) => {
    ctx.user._id;          // Id<"users">
    ctx.user.name;         // string
    ctx.user.role;         // "admin" | "user" | "moderator"
    ctx.user.email;        // string
    ctx.db;                // DatabaseWriter (normal ctx'ten fark yok)
    ctx.auth;              // Auth
    ctx.scheduler;         // Scheduler
  },
});
```

---

## Composition — Birden Fazla Middleware

Convex custom functions'ta native composition yok, ama elle yapılabilir:

```typescript
// İki ayrı input'u zincirle
async function withAuth(ctx: MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return user;
}

async function withRateLimit(ctx: MutationCtx, userId: Id<"users">) {
  const { ok } = await rateLimiter.limit(ctx, "api", { key: userId });
  if (!ok) throw new ConvexError({ code: "RATE_LIMITED" });
}

export const composedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await withAuth(ctx);
    await withRateLimit(ctx, user._id);
    return { ctx: { ...ctx, user }, args: {} };
  },
});
```

---

## Internal Functions için Aynı Pattern

```typescript
// Internal query — public API değil, backend'den çağrılır
export const internalAuthQuery = customQuery(internalQuery, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});

// Kullanım
export const getPrivateData = internalAuthQuery({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    // ctx.user mevcut
    return ctx.db.get(resourceId);
  },
});
```
