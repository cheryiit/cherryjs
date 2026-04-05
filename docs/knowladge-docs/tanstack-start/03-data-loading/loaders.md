# TanStack Start Data Loading

Kaynak: https://tanstack.com/router/latest

## Loading Stratejileri

| Strateji | Yontem | Kullanim |
|----------|--------|---------|
| Prefetch | `ensureQueryData` | SSR + client prefetch |
| Preload | `prefetchQuery` | Hover'da onceden yukle |
| Suspend | `useSuspenseQuery` | SSR-friendly hook |
| Loader | `loader` | Route-level data fetching |

## loader Fonksiyonu

```typescript
// src/routes/posts/$postId.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

export const Route = createFileRoute("/posts/$postId")({
  // SSR sirasinda calisir
  loader: async ({ context: { queryClient }, params: { postId } }) => {
    // ensureQueryData: cache'de yoksa fetch, varsa kullan
    const post = await queryClient.ensureQueryData(
      convexQuery(api.posts.get, { postId })
    );
    
    if (!post) throw notFound();
    
    // Paralel fetch
    await Promise.all([
      queryClient.ensureQueryData(convexQuery(api.users.get, { userId: post.authorId })),
      queryClient.ensureQueryData(convexQuery(api.comments.list, { postId })),
    ]);
  },
  
  pendingComponent: PostSkeleton,
  errorComponent: PostError,
  notFoundComponent: () => <div>Post not found</div>,
  
  component: PostPage,
});
```

## useSuspenseQuery ile Render

```typescript
function PostPage() {
  const { postId } = Route.useParams();
  
  // SSR'da server'da calisir, client'ta hydrate olur
  // Convex subscription'a donusur (real-time)
  const { data: post } = useSuspenseQuery(
    convexQuery(api.posts.get, { postId })
  );
  
  const { data: author } = useSuspenseQuery(
    convexQuery(api.users.get, { userId: post.authorId })
  );
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>By {author.name}</p>
    </article>
  );
}
```

## beforeLoad — Auth Redirect

```typescript
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    // Auth kontrolu — redirect veya throw
    const { isAuthenticated } = await context.auth.getStatus();
    if (!isAuthenticated) {
      throw redirect({ to: "/login", search: { returnTo: "/dashboard" } });
    }
  },
  component: DashboardPage,
});
```

## Context Gecirme

```typescript
// src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: {
      queryClient,
      // Eklenecek context burada tanımlanır
    },
  });
}

// Tip tanımı
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
```

## Pending Component (Loading State)

```typescript
export const Route = createFileRoute("/posts/$postId")({
  pendingComponent: () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
    </div>
  ),
  component: PostPage,
});
```

## Error Component

```typescript
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId")({
  errorComponent: ({ error }) => {
    const router = useRouter();
    
    return (
      <div>
        <h2>Error loading post</h2>
        <p>{error.message}</p>
        <button onClick={() => router.invalidate()}>Retry</button>
      </div>
    );
  },
  component: PostPage,
});
```

## Preloading (Hover)

```typescript
// router.tsx'te global preload stratejisi
const router = createRouter({
  routeTree,
  defaultPreload: "intent", // hover'da prefetch
  defaultPreloadStaleTime: 0,
});
```

## Convex + TanStack Query Senkronizasyonu

SSR → Client gecisinde veri tutarliligi:

```typescript
// router.tsx
import { setupRouterSsrQueryIntegration } from "@tanstack/react-query";

setupRouterSsrQueryIntegration(router, queryClient);
// Bu fonksiyon SSR'da toplanan veriyi client'ta hydrate eder
// Convex subscription'lar SSR'in biraktigi yerden devam eder
```
