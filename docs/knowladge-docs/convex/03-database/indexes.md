# Convex Indexes

Kaynak: https://docs.convex.dev/database/indexes

## Nedir?

Index'ler sorguları hızlandırır. `withIndex()` olmadan tablo taraması (full scan) yapılır.

## Index Tanımı

```typescript
// schema.ts
messages: defineTable({
  channel: v.id("channels"),
  body: v.string(),
  user: v.id("users"),
  type: v.string(),
})
  .index("by_channel", ["channel"])
  .index("by_channel_user", ["channel", "user"])
  .index("by_channel_type", ["channel", "type"]),
```

**Kural:** `_creationTime` her index'in sonuna otomatik eklenir.

## Index ile Sorgulama

### Eşitlik Koşulu

```typescript
const channelMessages = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) => q.eq("channel", channelId))
  .collect();
```

### Çoklu Eşitlik

```typescript
const userMessages = await ctx.db
  .query("messages")
  .withIndex("by_channel_user", (q) =>
    q.eq("channel", channelId).eq("user", userId)
  )
  .collect();
```

### Range Query

```typescript
// Son 1 saatin mesajları
const recent = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) =>
    q
      .eq("channel", channelId)
      .gt("_creationTime", Date.now() - 3600000)
  )
  .collect();

// Tüm range operatörleri
q.gt("field", value)   // >
q.gte("field", value)  // >=
q.lt("field", value)   // <
q.lte("field", value)  // <=
```

### Index Range Expression Kuralları

```
Sıra zorunlu:
1. Sıfır veya daha fazla .eq() — index field sırasına göre
2. Opsiyonel lower bound (.gt / .gte) — SADECE BİR TANE
3. Opsiyonel upper bound (.lt / .lte) — SADECE BİR TANE
```

```typescript
// ✅ Doğru — eq önce, sonra range
q.eq("channel", id).gt("_creationTime", ts)

// ❌ Yanlış — range önce olamaz
q.gt("_creationTime", ts).eq("channel", id)

// ❌ Yanlış — iki lower bound olamaz
q.gt("field", a).gte("field", b)
```

## Index Verimliliği

```typescript
// ❌ Verimsiz — index yok, full scan
ctx.db.query("messages")
  .filter(q => q.eq(q.field("channel"), channelId))

// ✅ Verimli — index kullanır
ctx.db.query("messages")
  .withIndex("by_channel", q => q.eq("channel", channelId))
```

## Redundant Index Temizleme

```typescript
// ❌ Redundant — by_channel, by_channel_user'ın prefix'i
.index("by_channel", ["channel"])
.index("by_channel_user", ["channel", "user"])

// ✅ by_channel_user, by_channel yerine de kullanılabilir
.index("by_channel_user", ["channel", "user"])
// by_channel sorgusu: .withIndex("by_channel_user", q => q.eq("channel", id))

// İSTİSNA: Sort order farklıysa ikisi de gerekli
// by_channel → _creationTime sırasına göre sort
// by_channel_user → user sırasına göre sort
```

## Staged Index (Büyük Tablolar)

```typescript
// Büyük tabloda index eklemek için önce staged
.index("by_channel", { fields: ["channel"], staged: true })

// Backfill tamamlandıktan sonra staged kaldır
.index("by_channel", ["channel"])
```

## Limitler

| Özellik | Limit |
|---------|-------|
| Index başına max field | 16 |
| Tablo başına max index | 32 |
| Duplicate field | Yasak |
| Reserved field (`_`) | Yasak (except `_creationTime`) |

## Naming Convention

```typescript
// by_ prefix ile adlandır
.index("by_authorId", ["authorId"])
.index("by_status_createdAt", ["status", "_creationTime"])
.index("by_userId_status", ["userId", "status"])
```

convex-helpers relationship helpers bu naming'e göre çalışır.
