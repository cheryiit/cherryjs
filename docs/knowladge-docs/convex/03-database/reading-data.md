# Convex Veri Okuma

Kaynak: https://docs.convex.dev/database/reading-data

## Tekil Döküman

```typescript
// ID ile döküman getir
const user = await ctx.db.get(userId); // User | null

// v.id validator ile güvenli
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId); // Table-specific ID garantili
  },
});
```

## Tablo Sorgulama

```typescript
// Tüm tabloyu çek (sadece küçük tablolar için)
const allUsers = await ctx.db.query("users").collect();

// İlk N kayıt
const firstTen = await ctx.db.query("users").take(10);

// İlk kayıt
const first = await ctx.db.query("users").first(); // User | null

// Tek kayıt (birden fazlaysa hata)
const unique = await ctx.db.query("users")
  .withIndex("by_email", q => q.eq("email", email))
  .unique(); // User | null, throws if multiple
```

## Index ile Sorgulama

```typescript
// Basit eşitlik
const userPosts = await ctx.db
  .query("posts")
  .withIndex("by_author", (q) => q.eq("authorId", userId))
  .collect();

// Çoklu koşul
const userDraftPosts = await ctx.db
  .query("posts")
  .withIndex("by_author_status", (q) =>
    q.eq("authorId", userId).eq("status", "draft")
  )
  .collect();

// Range query
const recentPosts = await ctx.db
  .query("posts")
  .withIndex("by_author", (q) =>
    q
      .eq("authorId", userId)
      .gt("_creationTime", Date.now() - 7 * 24 * 60 * 60 * 1000)
  )
  .collect();
```

## Sıralama

```typescript
// Eski → Yeni (default)
const oldToNew = await ctx.db.query("posts").order("asc").collect();

// Yeni → Eski
const newToOld = await ctx.db.query("posts").order("desc").collect();
```

## Filtreleme (küçük veri setleri)

```typescript
// Index yoksa TypeScript filter (prototyping için)
const activePremium = await ctx.db
  .query("users")
  .withIndex("by_role", q => q.eq("role", "premium"))
  .filter(q => q.eq(q.field("isActive"), true))
  .collect();
```

## Result Retrieval Methods

| Method | Dönüş | Kullanım |
|--------|-------|----------|
| `.collect()` | `T[]` | Küçük result setler |
| `.take(n)` | `T[]` | İlk n kayıt |
| `.first()` | `T \| null` | İlk kayıt |
| `.unique()` | `T \| null` | Tek kayıt (birden fazlaysa throw) |
| `.paginate(opts)` | `{page, isDone, continueCursor}` | Büyük setler |

## İlişki Traversal

```typescript
// Joins — JavaScript ile
const userWithPosts = async (ctx: QueryCtx, userId: Id<"users">) => {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_author", q => q.eq("authorId", userId))
    .collect();
    
  return { ...user, posts };
};

// Paralel fetch (N+1 sorun yok — db.get ~1ms)
const postsWithAuthors = async (ctx: QueryCtx, postIds: Id<"posts">[]) => {
  const posts = await Promise.all(postIds.map(id => ctx.db.get(id)));
  const validPosts = posts.filter(Boolean);
  
  const authors = await Promise.all(
    validPosts.map(post => ctx.db.get(post!.authorId))
  );
  
  return validPosts.map((post, i) => ({ ...post!, author: authors[i] }));
};
```

## Search Query

```typescript
// Full-text search
const results = await ctx.db
  .query("posts")
  .withSearchIndex("search_title", (q) =>
    q.search("title", searchTerm).eq("status", "published")
  )
  .take(20);
```

## Limitler

- `.collect()` ile max memory limiti aşılabilir
- Index olmadan büyük tablolarda `.filter()` yavaş
- 1 query'de max 8MB veri okunabilir
