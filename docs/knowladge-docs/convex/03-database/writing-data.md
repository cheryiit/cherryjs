# Convex Veri Yazma

Kaynak: https://docs.convex.dev/database/writing-data

## Insert

```typescript
// Yeni döküman oluştur — ID döner
const taskId = await ctx.db.insert("tasks", {
  title: "New Task",
  completed: false,
  priority: "medium",
  createdBy: userId,
});
// taskId: Id<"tasks">
```

## Patch (Kısmi Güncelleme)

Shallow merge — sadece belirtilen alanlar değişir:

```typescript
// Sadece belirtilen alanları güncelle
await ctx.db.patch("tasks", taskId, {
  completed: true,
  completedAt: Date.now(),
});
// Diğer alanlar değişmez

// Alan silme — undefined ile
await ctx.db.patch("tasks", taskId, {
  dueDate: undefined, // Bu alan silinir
});
```

**Davranış:**
- Yeni alanlar eklenir
- Mevcut alanlar üzerine yazılır
- `undefined` olan alanlar silinir

## Replace (Tam Üzerine Yazma)

```typescript
// Dökümanı tamamen değiştir
await ctx.db.replace("tasks", taskId, {
  title: "Updated Title",
  completed: false,
  // DİKKAT: Belirtilmeyen diğer alanlar silinir!
});
```

## Delete

```typescript
await ctx.db.delete("tasks", taskId);
```

## Bulk Operations (Transaction içinde)

Bir mutation içinde tüm yazma işlemleri tek transaction'da commit edilir:

```typescript
export const bulkCreateTasks = mutation({
  args: {
    tasks: v.array(v.object({
      title: v.string(),
      priority: v.string(),
    })),
  },
  handler: async (ctx, { tasks }) => {
    const ids = await Promise.all(
      tasks.map(task => ctx.db.insert("tasks", {
        ...task,
        completed: false,
      }))
    );
    return ids;
  },
});
```

## Performans Sınırları

| Operasyon | Limit |
|-----------|-------|
| Tek döküman boyutu | 1MB |
| Tek mutation toplam yazma | 8MB |
| Array max element | 8,192 |
| Object max property | 1,024 |

## Güvenli Yazma Pattern'i

```typescript
export const updatePost = mutation({
  args: {
    postId: v.id("posts"),
    updates: v.object({
      title: v.optional(v.string()),
      body: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { postId, updates }) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
    
    // 2. Kayıt varlık kontrolü
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError({ code: "NOT_FOUND" });
    
    // 3. Ownership check
    if (post.authorId !== identity.subject) {
      throw new ConvexError({ code: "UNAUTHORIZED" });
    }
    
    // 4. Güvenli patch
    await ctx.db.patch("posts", postId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});
```

## Cascade Delete Pattern

```typescript
export const deleteUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // 1. User'a ait tüm post'ları sil
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_author", q => q.eq("authorId", userId))
      .collect();
    
    await Promise.all(posts.map(post => ctx.db.delete("posts", post._id)));
    
    // 2. User'ı sil
    await ctx.db.delete("users", userId);
  },
});
```
