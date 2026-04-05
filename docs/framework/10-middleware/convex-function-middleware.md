# Convex Function Middleware — Derin Bakış

`lib/functions.ts` dosyasındaki wrapper'lar bir middleware pipeline'ıdır.
`customQuery`/`customMutation` zincirlenerek karmaşık pipeline'lar oluşturulabilir.

---

## Pipeline Nasıl Çalışır?

```
Client çağrısı
    ↓
[Wrapper 1: Auth check]       ctx = { db, auth, storage }
    ↓                              → ctx.user inject
[Wrapper 2: Rate limit]       ctx = { db, auth, storage, user }
    ↓                              → rate limit kontrolü
[Wrapper 3: Maintenance]      ctx = { db, auth, storage, user }
    ↓                              → parameter kontrolü
[Handler]                     ctx.user garantili, rate limit geçildi
```

`customMutation(previousWrapper, { input: ... })` şeklinde zincir kurulur.
Her `input` fonksiyonu:
- Önceki wrapper'dan gelen `ctx`'i alır (önceki inject'ler dahil)
- `ctx`'i augment edebilir
- Ek `args` consume edip handler'dan gizleyebilir
- Koşul sağlanmazsa throw eder — handler çalışmaz

---

## lib/functions.ts — Tam Pipeline

```typescript
// convex/lib/functions.ts

import {
  customQuery, customMutation, customAction,
} from "convex-helpers/server/customFunctions";
import {
  query, mutation, action,
  internalQuery, internalMutation, internalAction,
} from "../_generated/server";
import { v } from "convex/values";
import { errors } from "./errors";
import type { Doc, Id } from "../_generated/dataModel";

// ── User Resolver ─────────────────────────────────────────────────────────────

async function resolveCurrentUser(ctx: { auth: any; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique() as Promise<Doc<"users"> | null>;
}

// ── Tier 1: Public ────────────────────────────────────────────────────────────

export const publicQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const publicMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const publicAction = customAction(action, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

// ── Tier 2: Authenticated ─────────────────────────────────────────────────────
// Garantiler: geçerli session + users tablosunda kayıt + isActive: true
// Inject: ctx.user

export const authenticatedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authenticatedAction = customAction(action, {
  args: {},
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw errors.unauthenticated();
    return { ctx: { ...ctx, identity }, args: {} };
  },
});

// ── Tier 3: Admin ─────────────────────────────────────────────────────────────
// Garantiler: authenticated + role === "admin"
// Inject: ctx.user (role garantili admin)
// Uygulama: authenticatedMutation üstüne chain

export const adminQuery = customQuery(authenticatedQuery, {
  args: {},
  input: async (ctx) => {
    // ctx.user authenticated katmanından inject edildi
    if (ctx.user.role !== "admin") throw errors.forbidden("Admin access required");
    return { ctx, args: {} };
  },
});

export const adminMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    if (ctx.user.role !== "admin") throw errors.forbidden("Admin access required");
    return { ctx, args: {} };
  },
});

// ── Tier 4: Rate Limited ──────────────────────────────────────────────────────
// Garantiler: authenticated + rate limit geçildi
// Chain: authenticatedMutation → rateLimitedMutation

export const rateLimitedMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "mutations", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

// ── Tier 5: Maintenance-Aware ─────────────────────────────────────────────────
// Garantiler: authenticated + maintenance mode kapalı
// Kritik işlemler için (trade create, payment start, vb.)

export const activeSystemMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const maintenanceMode = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q: any) =>
        q.eq("domain", undefined).eq("key", "maintenance-mode")
      )
      .first();

    if (maintenanceMode?.value === true) {
      throw errors.forbidden("System is in maintenance mode");
    }

    return { ctx, args: {} };
  },
});

// ── Tier 6: Verified User ────────────────────────────────────────────────────
// Email doğrulaması gerektiren işlemler için

export const verifiedUserMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    if (!ctx.user.emailVerified) {
      throw errors.forbidden("Email verification required");
    }
    return { ctx, args: {} };
  },
});

// ── Internal ──────────────────────────────────────────────────────────────────

export const internalAuthQuery = customQuery(internalQuery, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const internalAuthMutation = customMutation(internalMutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});

export const internalAuthAction = customAction(internalAction, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
});
```

---

## Pipeline Seçim Rehberi

```
Kimse erişebilir?
  → publicQuery / publicMutation

Sadece giriş yapmış?
  → authenticatedQuery / authenticatedMutation

Admin mi?
  → adminQuery / adminMutation

Giriş yapmış + rate limit?
  → rateLimitedMutation

Giriş yapmış + sistem aktif?
  → activeSystemMutation (kritik işlemler için)

Giriş yapmış + email doğrulı?
  → verifiedUserMutation

Server-to-server?
  → internalAuthQuery / internalAuthMutation
```

---

## Özel Pipeline Oluşturma

Domain'e özgü middleware gerekiyorsa `lib/functions.ts`'e ekle.
Asla `apps/` içinde tanımlama — shared olması lazım.

### Örnek: Domain-Specific Rate Limit

```typescript
// lib/functions.ts'e ekle

export const tradingMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    // Trading-spesifik: max 5 trade/dakika
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "trade-create", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);

    // Trading-spesifik: maintenance
    const tradingEnabled = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q: any) =>
        q.eq("domain", "trading").eq("key", "trading-enabled")
      )
      .first();
    if (tradingEnabled?.value === false) {
      throw errors.forbidden("Trading is temporarily disabled");
    }

    return { ctx, args: {} };
  },
});
```

---

## `onSuccess` Hook

Mutation başarıyla tamamlandıktan sonra çalışan side effect.
Genellikle analytics veya notification tetiklemek için.

```typescript
export const auditedMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => ({ ctx, args: {} }),
  // Handler başarılıysa
  output: async (ctx, result) => {
    // Analytics veya audit (trigger'dan farklı — async)
    // Not: Bu output hook argümanlar hakkında bilgi taşımıyor
    // Detaylı audit için triggers kullan
    return result;
  },
});
```

---

## Arg Injection (Otomatik Argüman)

Wrapper, handler'a ek argüman inject edebilir (client'tan gelmez):

```typescript
// Örnek: session middleware
export const sessionMutation = customMutation(mutation, {
  args: { sessionId: v.id("sessions") },  // client'tan gelir
  input: async (ctx, { sessionId }) => ({
    ctx: { ...ctx, sessionId },  // inject
    args: {},                     // handler'dan gizle
  }),
});

// Handler artık sessionId almak zorunda değil — ctx'de var
export const addToCart = sessionMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    ctx.sessionId  // inject edildi
    ctx.db.insert("cartItems", { sessionId: ctx.sessionId, productId });
  },
});
```

---

## Middleware Execution Sırası

Zincir derinliği en dıştan en içe çalışır:

```
adminMutation çağrısı:
  1. mutation (Convex base) — raw context oluştur
  2. authenticatedQuery'nin input — user resolve + auth check
  3. adminMutation'ın input — role check
  4. Handler — ctx.user garantili, role === "admin" garantili
```

Hata fırlatıldığında sonraki adımlar çalışmaz.

---

## Type Safety

Her wrapper'ın inject ettiği şeyler TypeScript'te tam tiplidir:

```typescript
// authenticatedMutation handler'ında:
handler: async (ctx) => {
  ctx.user          // Doc<"users"> — null olamaz
  ctx.user._id      // Id<"users">
  ctx.user.role     // "admin" | "user"
  ctx.db            // DatabaseWriter
  ctx.scheduler     // Scheduler
}

// adminMutation handler'ında:
handler: async (ctx) => {
  ctx.user.role     // "admin" | "user" — ama çalışma zamanında admin garantili
  // TypeScript bunu bilmiyor — runtime garantisi var
}
```

`ctx.user.role` tipi her iki wrapper'da da `"admin" | "user"`.
`adminMutation` wrapper'ı TypeScript'te narrowing yapmaz — runtime check var.
Bunu iyileştirmek için explicit narrowed tip kullanılabilir:

```typescript
type AdminUser = Doc<"users"> & { role: "admin" };
type AdminCtx = { user: AdminUser; db: DatabaseWriter; ... };
```
