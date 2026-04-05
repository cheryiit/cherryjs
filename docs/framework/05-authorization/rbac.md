# RBAC — Role-Based Access Control

**Dosya:** `convex/lib/permissions.ts`

---

## Rol Hiyerarşisi

```
admin ──→ tüm yetkiler
user  ──→ kendi kaydı üzerindeki yetkiler
```

İki rol vardır: `"admin"` ve `"user"`.
Rol, `users` tablosundaki `role` alanında saklanır.
Clerk webhook ile otomatik sync edilir — yeni kullanıcılar `"user"` rolüyle oluşturulur.

---

## Permission Registry

Tüm izinler `permissions.ts`'te sabit olarak tanımlanır.
String literal yerine `Permission.X` kullanılır — autocomplete + typo koruması.

```typescript
export const Permission = {
  // Users
  USERS_READ:           "users:read",
  USERS_UPDATE_OWN:     "users:update:own",
  USERS_UPDATE_ANY:     "users:update:any",
  USERS_DELETE_OWN:     "users:delete:own",
  USERS_DELETE_ANY:     "users:delete:any",

  // Trading
  TRADES_READ_OWN:      "trades:read:own",
  TRADES_READ_ANY:      "trades:read:any",  // admin
  TRADES_CREATE:        "trades:create",
  TRADES_CANCEL_OWN:    "trades:cancel:own",
  TRADES_CANCEL_ANY:    "trades:cancel:any",  // admin

  // Admin
  ADMIN_ACCESS:         "admin:access",
  AUDIT_LOGS_READ:      "audit:logs:read",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
```

---

## Rol → Permission Mapping

```typescript
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    // Tüm user yetkileri
    Permission.USERS_READ,
    Permission.USERS_UPDATE_OWN,
    Permission.USERS_UPDATE_ANY,
    Permission.USERS_DELETE_OWN,
    Permission.USERS_DELETE_ANY,

    // Tüm trade yetkileri
    Permission.TRADES_READ_OWN,
    Permission.TRADES_READ_ANY,
    Permission.TRADES_CREATE,
    Permission.TRADES_CANCEL_OWN,
    Permission.TRADES_CANCEL_ANY,

    // Admin
    Permission.ADMIN_ACCESS,
    Permission.AUDIT_LOGS_READ,
  ],
  user: [
    Permission.USERS_READ,
    Permission.USERS_UPDATE_OWN,
    Permission.USERS_DELETE_OWN,
    Permission.TRADES_READ_OWN,
    Permission.TRADES_CREATE,
    Permission.TRADES_CANCEL_OWN,
  ],
};
```

---

## Yardımcı Fonksiyonlar

```typescript
// Tek yetki kontrolü
hasPermission(role, Permission.TRADES_CREATE)
// → boolean

// Herhangi biri var mı?
hasAnyPermission(role, [Permission.TRADES_CANCEL_OWN, Permission.TRADES_CANCEL_ANY])
// → boolean

// Hepsi var mı?
hasAllPermissions(role, [Permission.TRADES_READ_OWN, Permission.TRADES_CREATE])
// → boolean

// Sahiplik + yetki kombinasyonu
canPerform(role, userId, resourceOwnerId, Permission.TRADES_CANCEL_OWN, Permission.TRADES_CANCEL_ANY)
// → boolean  (kendi ise OWN, başkasınsa ANY)
```

---

## Business Katmanında Kullanım

```typescript
// convex/apps/trading/trading.business.ts

export const cancelTrade = internalMutation({
  args: {
    tradeId: v.id("trades"),
    requestingUserId: v.id("users"),
    requestingUserRole: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, { tradeId, requestingUserId, requestingUserRole }) => {
    const trade = await getTradeById(ctx, tradeId);
    if (!trade) throw errors.notFound("Trade");

    // canPerform: kendi trade'iyse OWN, değilse ANY
    const allowed = canPerform(
      requestingUserRole,
      requestingUserId,
      trade.userId,
      Permission.TRADES_CANCEL_OWN,
      Permission.TRADES_CANCEL_ANY
    );
    if (!allowed) throw errors.forbidden();

    await ctx.db.patch(tradeId, { status: "cancelled" });
  },
});
```

```typescript
// convex/apps/trading/trading.channel.ts

export const cancel = authenticatedMutation({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    return ctx.runMutation(internal.apps.trading.tradingBusiness.cancelTrade, {
      tradeId,
      requestingUserId: ctx.user._id,
      requestingUserRole: ctx.user.role,  // ← wrapper'dan güvenli geliyor
    });
  },
});
```

---

## Yeni Permission Ekleme Adımları

1. `permissions.ts`'te `Permission` objesine ekle
2. `ROLE_PERMISSIONS` mapping'ine hangi rollerin sahip olduğunu belirt
3. Business katmanında `hasPermission()` ile kullan
4. Architectural test (varsa) permission kayıtlarını kontrol eder

---

## Admin Rolü Atama

Admin rolü sadece mevcut adminler tarafından atanabilir:

```typescript
// convex/apps/users/users.channel.ts
export const setRole = adminMutation({  // ← sadece admin
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.apps.users.usersBusiness.setUserRole, args);
  },
});
```

İlk admin, Convex dashboard'dan veya seed mutation'ından atanır.
