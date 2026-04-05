# Convex Pagination

Kaynak: https://docs.convex.dev/database/pagination

## Cursor-Based Pagination

Convex **cursor-based pagination** kullanır. Her sayfa bir cursor döner, sonraki sayfa bu cursor ile istenir.

## Server Tarafı

```typescript
import { paginationOptsValidator } from "convex/server";

export const listPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    authorId: v.optional(v.id("users")),
  },
  handler: async (ctx, { paginationOpts, authorId }) => {
    let q = ctx.db.query("posts");
    
    if (authorId) {
      q = q.withIndex("by_author", (query) => query.eq("authorId", authorId));
    } else {
      q = q.order("desc");
    }
    
    const result = await q.paginate(paginationOpts);
    
    // Page'i transform edebilirsin
    return {
      ...result,
      page: result.page.map(post => ({
        ...post,
        excerpt: post.body.slice(0, 100),
      })),
    };
  },
});
```

## React Client — usePaginatedQuery

```typescript
import { usePaginatedQuery } from "convex/react";

function PostList({ authorId }: { authorId?: Id<"users"> }) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.posts.listPosts,
    { authorId },
    { initialNumItems: 20 }
  );
  
  return (
    <div>
      {results.map(post => <PostCard key={post._id} post={post} />)}
      
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(20)}>Load More</button>
      )}
      
      {status === "LoadingMore" && <Spinner />}
      {status === "Exhausted" && <p>All posts loaded</p>}
    </div>
  );
}
```

## Status Değerleri

| Status | Açıklama |
|--------|----------|
| `"LoadingFirstPage"` | İlk yükleme |
| `"CanLoadMore"` | Daha fazla veri var |
| `"LoadingMore"` | Ek sayfalar yükleniyor |
| `"Exhausted"` | Tüm veri yüklendi |

## Manuel Pagination (Non-React)

```typescript
// Tüm sayfaları toplamak için
async function fetchAllPosts(ctx: QueryCtx) {
  let cursor: string | null = null;
  const allPosts = [];
  
  do {
    const result = await ctx.db
      .query("posts")
      .paginate({ cursor, numItems: 100 });
    
    allPosts.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);
  
  return allPosts;
}
```

## Reaktif Davranış

Page boyutları değişebilir:
- Veri eklenirse sayfa büyüyebilir
- Veri silinirse sayfa küçülebilir

Bu Convex'in automatic reactivity özelliği — UI otomatik güncellenir.

## TanStack Start ile Kullanım

```typescript
// loader'da prefetch
export const Route = createFileRoute("/posts")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.prefetchInfiniteQuery(
      convexQuery(api.posts.listPosts, { initialNumItems: 20 })
    );
  },
  component: PostsPage,
});

// Component'ta suspense ile
function PostsPage() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery(
    convexQuery(api.posts.listPosts, {})
  );
  
  return (
    <>
      {data.pages.flatMap(p => p.page).map(post => (
        <PostCard key={post._id} post={post} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load More</button>
      )}
    </>
  );
}
```
