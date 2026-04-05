# Convex Full-Text Search

Kaynak: https://docs.convex.dev/search/text-search

## Motor

Convex, **Tantivy** (Rust tabanlı, Apache Lucene uyumlu) kullanır.

## Search Index Tanımı

```typescript
// schema.ts
posts: defineTable({
  title: v.string(),
  body: v.string(),
  status: v.string(),
  authorId: v.id("users"),
})
  .searchIndex("search_title", {
    searchField: "title",           // Aranacak alan
    filterFields: ["status"],       // Hızlı filtreleme icin
  })
  .searchIndex("search_body", {
    searchField: "body",
    filterFields: ["status", "authorId"],
  }),
```

## Arama Sorgusu

```typescript
export const searchPosts = query({
  args: {
    query: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { query, status }) => {
    let search = ctx.db
      .query("posts")
      .withSearchIndex("search_title", (q) => {
        let s = q.search("title", query);
        if (status) s = s.eq("status", status);
        return s;
      });
    
    return search.take(20);
  },
});
```

## Arama Davranisi

### Prefix Matching
Son kelime prefix olarak aranir:
- `"r"` → "rabbit", "react", "request" esleşir
- `"re"` → "react", "request" esleşir

### Relevance Siralamasi
BM25 algoritmasi + ekstra faktörler:
1. BM25 skoru (term frequency)
2. Proximity (kelimelerin yakinligi)
3. Exact match sayisi
4. Doküman yeniligi (skor esitliğinde)

## Limitler

| Ozellik | Limit |
|---------|-------|
| Filter fields per index | 16 |
| Search terms per query | 16 |
| Max scannable results | 1,024 |
| Dil desteği | İngilizce / Latin alfabesi |

## Onemli Notlar

1. Search sonuclari **reactive** — yeni eklenen dokümanlar otomatik dahil
2. `.paginate()` ile birlikte kullanılabilir
3. `.filter()` ile search sonuclarini daha da daraltalabilir
4. Tek query'de birden fazla `.withSearchIndex()` kullanılamaz

## Gelismis Kullanim

```typescript
export const globalSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query, limit = 10 }) => {
    // Sadece published postlari ara
    const posts = await ctx.db
      .query("posts")
      .withSearchIndex("search_title", (q) =>
        q.search("title", query).eq("status", "published")
      )
      .take(limit);
    
    // Author bilgilerini ekle
    const postsWithAuthors = await Promise.all(
      posts.map(async (post) => ({
        ...post,
        author: await ctx.db.get(post.authorId),
      }))
    );
    
    return postsWithAuthors;
  },
});
```
