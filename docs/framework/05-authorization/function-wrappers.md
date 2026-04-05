# Function Wrapper'ları

**Dosya:** `convex/lib/functions.ts`
**Her channel fonksiyonu bu wrapper'lardan birini kullanır.**

---

## Wrapper Listesi

```typescript
import {
  // Public
  publicQuery,
  publicMutation,
  publicAction,

  // Authenticated (giriş + aktif)
  authenticatedQuery,
  authenticatedMutation,
  authenticatedAction,

  // Admin only
  adminQuery,
  adminMutation,

  // Internal (server-to-server)
  internalAuthQuery,
  internalAuthMutation,
  internalAuthAction,
} from "../../lib/functions";
```

---

## Her Wrapper'ın Garantisi

### `publicQuery` / `publicMutation` / `publicAction`

```
Garanti: HİÇBİR garanti — herkese açık
ctx.user: mevcut değil
Kullanım: Landing page verileri, genel arama, webhook endpoint'leri
```

```typescript
export const getPublicStats = publicQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("stats").first();
    // ctx.user yok — dikkat
  },
});
```

### `authenticatedQuery` / `authenticatedMutation` / `authenticatedAction`

```
Garanti: Geçerli Clerk session + users tablosunda kayıt var + isActive: true
ctx.user: Doc<"users"> — tam kullanıcı nesnesi
Hata: UNAUTHENTICATED (session yok) | FORBIDDEN (hesap deaktif)
```

```typescript
export const listMine = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    // ctx.user garantili
    return ctx.db.query("trades")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});
```

### `adminQuery` / `adminMutation`

```
Garanti: authenticated + ctx.user.role === "admin"
ctx.user: Doc<"users"> — admin olduğu garantili
Hata: FORBIDDEN ("Admin access required")
```

```typescript
export const listAllUsers = adminQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").collect();
    // Sadece adminler görebilir
  },
});
```

### `internalAuthQuery` / `internalAuthMutation` / `internalAuthAction`

```
Garanti: Sadece server-side çağrı (Convex internal)
ctx.user: mevcut değil (server-to-server)
Client'tan çağrılamaz
```

---

## Özel Wrapper Oluşturma

Mevcut wrapper'lar bir ihtiyacı karşılamıyorsa `lib/functions.ts`'e yeni wrapper eklenebilir.

### Örnek: Rate Limited Mutation

```typescript
// lib/functions.ts'e ekle
export const rateLimitedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");

    // Rate limit kontrolü
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "mutations", {
      key: user._id,
    });
    if (!ok) throw errors.rateLimited(retryAfter);

    return { ctx: { ...ctx, user }, args: {} };
  },
});
```

### Örnek: Verified User Mutation

```typescript
export const verifiedUserMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");
    if (!user.emailVerified) throw errors.forbidden("Email verification required");
    return { ctx: { ...ctx, user }, args: {} };
  },
});
```

---

## Wrapper Composition

Wrapper'lar `customQuery(existingWrapper, ...)` ile zincirlenebilir:

```typescript
// Authenticated → Admin şeklinde zincir (adminQuery aslında bunu yapar)
export const superAdminMutation = customMutation(adminMutation, {
  args: {},
  input: async (ctx) => {
    // ctx.user zaten inject edilmiş ve admin olduğu kontrol edilmiş
    if (!ctx.user.isSuperAdmin) throw errors.forbidden("Super admin required");
    return { ctx, args: {} };
  },
});
```

---

## ctx.user Tipi

```typescript
// authenticatedQuery/Mutation'da ctx.user tipi:
type AuthenticatedCtx = {
  user: {
    _id: Id<"users">;
    _creationTime: number;
    tokenIdentifier: string;
    clerkId: string;
    name: string;
    email: string;
    imageUrl?: string;
    role: "admin" | "user";
    isActive: boolean;
    lastSeenAt?: number;
  };
  db: DatabaseReader; // veya DatabaseWriter (mutation ise)
  auth: Auth;
  storage: StorageReader;
  scheduler: Scheduler; // (mutation ise)
};
```

`ctx.user._id` her zaman `Id<"users">` tipindedir — cast gerekmez.
