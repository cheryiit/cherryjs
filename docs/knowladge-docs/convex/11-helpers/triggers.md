# Convex Triggers

Kaynak: https://stack.convex.dev/triggers
GitHub: https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/triggers.ts

## Nedir?

Trigger'lar bir tablodaki veri değiştiğinde (insert/update/delete) **otomatik olarak** ve **aynı mutation içinde atomik** çalışan fonksiyonlardır.

> "Triggers run within the same mutation that changes the data, so they run atomically with the data changing."

---

## Change Tipi

```typescript
type Change<Doc> =
  | { operation: "insert"; id: Id; oldDoc: null;  newDoc: Doc }
  | { operation: "update"; id: Id; oldDoc: Doc;   newDoc: Doc }
  | { operation: "delete"; id: Id; oldDoc: Doc;   newDoc: null }
```

---

## Kurulum

```typescript
// convex/lib/triggers.ts
import { Triggers } from "convex-helpers/server/triggers";
import { customMutation, customCtx } from "convex-helpers/server/customFunctions";
import { mutation, internalMutation } from "../_generated/server";
import type { DataModel } from "../_generated/dataModel";

const triggers = new Triggers<DataModel>();

// ──────────────────────────────────────────────────────────────
// Trigger kayıtları
// ──────────────────────────────────────────────────────────────

// 1. Audit log — her users değişikliğini logla
triggers.register("users", async (ctx, change) => {
  if (change.operation === "insert") {
    await ctx.db.insert("auditLogs", {
      table: "users",
      operation: "insert",
      documentId: change.id,
      timestamp: Date.now(),
    });
  } else if (change.operation === "update") {
    await ctx.db.insert("auditLogs", {
      table: "users",
      operation: "update",
      documentId: change.id,
      before: JSON.stringify(change.oldDoc),
      after: JSON.stringify(change.newDoc),
      timestamp: Date.now(),
    });
  } else if (change.operation === "delete") {
    await ctx.db.insert("auditLogs", {
      table: "users",
      operation: "delete",
      documentId: change.id,
      before: JSON.stringify(change.oldDoc),
      timestamp: Date.now(),
    });
  }
});

// 2. Denormalization — post silinince comment sayısını güncelle
triggers.register("comments", async (ctx, change) => {
  const postId =
    change.newDoc?.postId ?? change.oldDoc?.postId;
  if (!postId) return;

  const count = await ctx.db
    .query("comments")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect()
    .then((r) => r.length);

  await ctx.db.patch("posts", postId, { commentCount: count });
});

// 3. Cascade delete — post silinince tüm comment'ler silinir
triggers.register("posts", async (ctx, change) => {
  if (change.operation !== "delete") return;

  const comments = await ctx.db
    .query("comments")
    .withIndex("by_post", (q) => q.eq("postId", change.id))
    .collect();

  await Promise.all(comments.map((c) => ctx.db.delete("comments", c._id)));
});

// 4. Search index denormalization
// Birden fazla alandan tek searchable field oluştur
triggers.register("products", async (ctx, change) => {
  if (change.operation === "delete") return;
  const doc = change.newDoc!;

  await ctx.db.patch("products", change.id, {
    searchText: [doc.name, doc.brand, doc.description].join(" "),
  });
});

// ──────────────────────────────────────────────────────────────
// Trigger'ları mutation'lara wrap et
// ──────────────────────────────────────────────────────────────

// ÖNEMLI: Trigger'ların çalışması için mutation'ları wrap etmelisin
export const triggeredMutation = customMutation(
  mutation,
  customCtx((ctx) => triggers.wrapDB(ctx))
);

export const triggeredInternalMutation = customMutation(
  internalMutation,
  customCtx((ctx) => triggers.wrapDB(ctx))
);
```

---

## Kullanım

```typescript
// convex/functions/posts.ts
import { triggeredMutation } from "../lib/triggers";
import { v } from "convex/values";

// Bu mutation yazıldığında posts trigger'ı çalışır
export const createPost = triggeredMutation({
  args: {
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { title, body }) => {
    return ctx.db.insert("posts", { title, body, commentCount: 0 });
    // posts trigger: insert → audit log
  },
});

export const deletePost = triggeredMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await ctx.db.delete("posts", postId);
    // posts trigger: delete → cascade comment sil
  },
});

export const addComment = triggeredMutation({
  args: { postId: v.id("posts"), body: v.string() },
  handler: async (ctx, { postId, body }) => {
    const commentId = await ctx.db.insert("comments", { postId, body });
    // comments trigger: insert → post.commentCount güncelle
    return commentId;
  },
});
```

---

## Kullanım Alanları

### 1. Audit Logging
```typescript
triggers.register("users", async (ctx, change) => {
  await ctx.db.insert("auditLogs", {
    operation: change.operation,
    documentId: change.id,
    timestamp: Date.now(),
  });
});
```

### 2. Denormalized Count
```typescript
triggers.register("likes", async (ctx, change) => {
  const postId = change.newDoc?.postId ?? change.oldDoc?.postId;
  if (!postId) return;

  const likeCount = await ctx.db
    .query("likes")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect()
    .then((r) => r.length);

  await ctx.db.patch("posts", postId, { likeCount });
});
```

### 3. Validation (Business Rule)
```typescript
triggers.register("orders", async (ctx, change) => {
  if (change.operation === "insert") {
    if (change.newDoc.total < 0) {
      throw new ConvexError("Order total cannot be negative");
    }
  }
});
```

### 4. Async Side Effect (Debounced)
```typescript
triggers.register("documents", async (ctx, change) => {
  if (change.operation === "delete") return;

  // Debounce: 5sn içinde başka değişiklik olursa iptal et
  await ctx.scheduler.runAfter(
    5000,
    internal.search.reindexDocument,
    { documentId: change.id }
  );
});
```

---

## Kritik Uyarılar

### ⚠️ Error Catching Riski
```typescript
// YANLIŞ — hata yakalanırsa veri yine de commit olur
export const badMutation = triggeredMutation({
  args: {},
  handler: async (ctx) => {
    try {
      await ctx.db.insert("orders", { /* ... */ });
      // Trigger hata fırlatırsa burada yakalanır
      // Ama orders tablosuna yazma zaten olmuş!
    } catch (e) {
      console.error(e); // Veri bozuldu
    }
  },
});

// DOĞRU — hatayı handler seviyesinde yakalama
export const goodMutation = triggeredMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.insert("orders", { /* ... */ });
    // Trigger hata fırlatırsa tüm mutation rollback olur ✓
  },
});
```

### ⚠️ Coverage Eksikliği
Trigger'lar sadece `triggeredMutation` ile wrap edilmiş mutation'larda çalışır:
- Dashboard'dan doğrudan edit → Trigger çalışmaz
- Data import → Trigger çalışmaz
- `mutation` ile (wrap edilmemiş) → Trigger çalışmaz

### ⚠️ Write Contention
Yüksek frekanslı güncelleme gerektiren trigger'lar (like counter) contention yaratabilir.
Bunun için `@convex-dev/aggregate` veya `@convex-dev/sharded-counter` kullan.

---

## Recursion — Breadth-First

Trigger başka bir mutation çalıştırırsa, o mutation'ın trigger'ları **breadth-first** sırayla çalışır:

```
Mutation A → Trigger 1, Trigger 2
              ↓           ↓
           Trigger 1   Trigger 2
            çalışır      çalışır
```

Recursive trigger loop'ları sonsuz döngüye girmez — Convex bunu tespit eder.
