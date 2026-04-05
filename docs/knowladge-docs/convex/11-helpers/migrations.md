# Convex Data Migrations

Kaynak: https://stack.convex.dev/migrating-data-with-mutations

## Iki Migration Tipi

| Tip | Nasil | Ornek |
|-----|-------|-------|
| **Schema Migration** | schema.ts guncelleme | Alan adi degistirme |
| **Data Migration** | Mutation ile veri donusturme | Default deger doldurma |

## Guvenli Alan Ekleme Pattern'i

```
Adim 1: Alani optional yap
Adim 2: Migration mutation calistir
Adim 3: Alani required yap
```

### Adim 1: Optional Alan Ekle

```typescript
// schema.ts
users: defineTable({
  name: v.string(),
  email: v.string(),
  
  // Yeni alan — once optional
  displayName: v.optional(v.string()),
}),
```

### Adim 2: Migration Mutation

```typescript
// convex/migrations/addDisplayName.ts
import { internalMutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";

export const migrateDisplayName = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("displayName"), undefined))
      .paginate(paginationOpts);
    
    await Promise.all(
      result.page.map(user =>
        ctx.db.patch("users", user._id, {
          displayName: user.name, // default deger
        })
      )
    );
    
    return result.isDone;
  },
});
```

CLI'dan calistir:
```bash
# Dashboard veya CLI ile
npx convex run migrations/addDisplayName:migrateDisplayName
```

### Adim 3: Required Yap

```typescript
// schema.ts
users: defineTable({
  name: v.string(),
  email: v.string(),
  displayName: v.string(), // artik required
}),
```

## Buyuk Tablo Migration (Recursive Scheduling)

```typescript
// convex/migrations/largeMigration.ts
export const startMigration = internalMutation({
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.processBatch,
      { cursor: null }
    );
  },
});

export const processBatch = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const BATCH_SIZE = 100;
    
    const result = await ctx.db
      .query("largeTable")
      .paginate({ cursor, numItems: BATCH_SIZE });
    
    // Batch'i isle
    await Promise.all(
      result.page.map(doc =>
        ctx.db.patch("largeTable", doc._id, {
          // Transformasyon
          newField: computeValue(doc),
        })
      )
    );
    
    // Daha fazla veri varsa devam et
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        100, // 100ms bekle — rate limit icin
        internal.migrations.processBatch,
        { cursor: result.continueCursor }
      );
    } else {
      console.log("Migration tamamlandi!");
    }
  },
});
```

## Alan Silme Pattern'i

```typescript
// Adim 1: Alani optional yap (backward compat)
oldField: v.optional(v.string()),

// Adim 2: Kodu guncelle — artik oldField kullanma
// Adim 3: Migration ile tum dokumanlarda undefined yap
export const removeOldField = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db
      .query("users")
      .filter(q => q.neq(q.field("oldField"), undefined))
      .paginate({ cursor, numItems: 100 });
    
    await Promise.all(
      result.page.map(user =>
        ctx.db.patch("users", user._id, { oldField: undefined })
      )
    );
    
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.removeOldField, {
        cursor: result.continueCursor,
      });
    }
  },
});

// Adim 4: Alan'i schema'dan tamamen cikar
```

## Tip Degistirme Pattern'i

```typescript
// string'den number'a
// Adim 1: Union yap
age: v.union(v.string(), v.number()),

// Adim 2: Migration
users.map(user =>
  ctx.db.patch("users", user._id, {
    age: typeof user.age === "string" ? parseInt(user.age) : user.age,
  })
)

// Adim 3: Sadece number kal
age: v.number(),
```

## Best Practices

1. **Once kucuk test et** — Migration'i development'ta calistir
2. **Seri calistir** — Paralel burst yerine sirayla
3. **Progress kaydet** — Cursor ile nerede kaldigini biliyorsun
4. **Geri alinabilir** — Migration'dan once backup al
5. **Yeni yazma icin default sagla** — Migration oncesinde yeni kayitlar bozulmasin

```typescript
// Yeni kayitlar icin kod guncelleme (migration oncesinde)
export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    return ctx.db.insert("users", {
      name,
      email,
      displayName: name, // Migration beklenmeden default sagla
    });
  },
});
```
