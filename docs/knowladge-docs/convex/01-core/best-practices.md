# Convex Best Practices

Kaynak: https://docs.convex.dev/understanding/best-practices

## Checklist

- [ ] Tüm promise'ler await edilmeli
- [ ] `.filter()` yerine `.withIndex()` kullan
- [ ] `.collect()` sadece küçük result setleri için
- [ ] Redundant index'leri kaldır
- [ ] Tüm public fonksiyonlar argument validator içermeli
- [ ] Access control her public fonksiyonda `ctx.auth` ile
- [ ] Scheduled tasks `internal.*` referansları ile
- [ ] Business logic `convex/model/` klasöründe
- [ ] Gereksiz `runAction` kullanımından kaçın
- [ ] Actions'ta sequential `ctx.runMutation`'ları birleştir
- [ ] `ctx.db` çağrılarında tablo adı her zaman belirt
- [ ] Query'lerde `Date.now()` kullanma

---

## 1. Tüm Promise'leri Await Et

```typescript
// ❌ Yanlış
ctx.scheduler.runAfter(0, internal.tasks.cleanup, {});
ctx.db.patch("users", userId, { lastSeen: Date.now() });

// ✅ Doğru
await ctx.scheduler.runAfter(0, internal.tasks.cleanup, {});
await ctx.db.patch("users", userId, { lastSeen: Date.now() });
```

**ESLint:** `no-floating-promises` kuralını aktifleştir.

---

## 2. Index Kullan, filter() Değil

```typescript
// ❌ Yavaş — full table scan
const messages = await ctx.db
  .query("messages")
  .filter((q) => q.eq(q.field("channel"), channelId))
  .collect();

// ✅ Hızlı — index kullanır
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) => q.eq("channel", channelId))
  .collect();
```

**İstisna:** Paginated query'lerde `.filter()` kullanılabilir çünkü code-based filtering page size'ı beklenmedik şekilde düşürür.

---

## 3. collect() Limitini Bil

```typescript
// ❌ Tehlikeli — tüm dökümanlar memory'e çekilir
const allUsers = await ctx.db.query("users").collect();

// ✅ Güvenli — paginate veya take kullan
const users = await ctx.db
  .query("users")
  .withIndex("by_status", (q) => q.eq("status", "active"))
  .take(100);

// ✅ Büyük veri seti için paginate
const result = await ctx.db
  .query("users")
  .paginate(paginationOpts);
```

---

## 4. Argument Validators Zorunlu

```typescript
// ❌ Güvensiz — malicious client her şey gönderebilir
export const createPost = mutation({
  handler: async (ctx, args) => { ... }
});

// ✅ Güvenli
export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => { ... }
});
```

**ESLint:** `@convex-dev/require-argument-validators` kuralını aktifleştir.

---

## 5. Access Control Her Zaman ctx.auth ile

```typescript
// ❌ Spoofable — client manipüle edebilir
export const getMyPosts = query({
  args: { email: v.string() }, // email argüman olarak almak tehlikeli
  handler: async (ctx, { email }) => {
    return ctx.db.query("posts").filter(q => q.eq(q.field("email"), email)).collect();
  }
});

// ✅ Güvenli
export const getMyPosts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    
    return ctx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", identity.subject))
      .collect();
  }
});
```

---

## 6. Internal Functions ile Security

```typescript
// Public fonksiyon — sadece arg validation + auth check
export const upgradePlan = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    // Payment verification burada...
    await ctx.runMutation(internal.plans.markAsPro, { planId });
  }
});

// Internal fonksiyon — doğrudan çağrılamaz
export const markAsPro = internalMutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    await ctx.db.patch("plans", planId, { type: "professional" });
  }
});
```

---

## 7. Business Logic Model Katmanında

```typescript
// convex/model/users.ts — pure TypeScript, test edilebilir
export async function getUserWithPosts(
  ctx: QueryCtx,
  userId: Id<"users">
) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_author", q => q.eq("authorId", userId))
    .collect();
  return { ...user, posts };
}

// convex/functions/users.ts — thin wrapper
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return getUserWithPosts(ctx, userId);
  }
});
```

---

## 8. Date.now() Query'de Kullanma

```typescript
// ❌ Cache'i bozar — her render'da farklı sonuç
export const getRecentPosts = query({
  handler: async (ctx) => {
    return ctx.db
      .query("posts")
      .filter(q => q.gt(q.field("createdAt"), Date.now() - 3600000))
      .collect();
  }
});

// ✅ Client'tan zaman al veya flag kullan
export const getRecentPosts = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    return ctx.db
      .query("posts")
      .withIndex("by_created", q => q.gt("_creationTime", since))
      .collect();
  }
});
```

---

## 9. Explicit Table Names

```typescript
// ✅ Her zaman tablo adını belirt
await ctx.db.get("users", userId);
await ctx.db.patch("users", userId, { name: "New Name" });
await ctx.db.delete("users", userId);
```

**ESLint:** `@convex-dev/explicit-table-ids` kuralı.
