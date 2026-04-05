# Convex + TanStack Start Entegrasyonu

Kaynak:
- https://docs.convex.dev/client/react/tanstack-start
- https://github.com/TanStack/router/tree/main/examples/react/start-convex-trellaux

## Nasil Calisir?

TanStack Start + Convex = **SSR + Real-time**

1. **SSR sirasinda**: `useSuspenseQuery` server'da calısır, data HTML'e gomulur
2. **Client'a geldikce**: Convex subscription'a donusur, real-time guncellemeler baslar
3. **Timestamp senkronizasyonu**: Convex, SSR ile client arasindaki tutarsizligi timestamp ile cozar

## Kurulum

```bash
pnpm add convex @convex-dev/react-query @tanstack/react-query
```

## router.tsx Kurulumu

```typescript
// src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { QueryClient } from "@tanstack/react-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import {
  setupRouterSsrQueryIntegration,
  type RouterContext,
} from "@tanstack/react-start/client";

// Convex client
export const convexClient = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? ""
);

// Convex Query Client
export const convexQueryClient = new ConvexQueryClient(convexClient);

// React Query Client with Convex integration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      staleTime: 0,
    },
  },
});

convexQueryClient.connect(queryClient);

export function createAppRouter() {
  const router = createRouter({
    routeTree,
    context: { queryClient } satisfies RouterContext,
    defaultPreload: "intent",
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration(router, queryClient);

  return router;
}
```

## Root Route — Provider Sarma

```typescript
// src/routes/__root.tsx
import { createRootRouteWithContext } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/tanstack-start";
import { convexClient } from "../router";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <html>
          <head />
          <body>
            <Outlet />
          </body>
        </html>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## Route'ta Convex Query Kullanimi

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/posts/")({
  // SSR sirasinda data prefetch
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      convexQuery(api.posts.listPublished, { limit: 20 })
    );
  },
  component: PostsPage,
});

function PostsPage() {
  // useSuspenseQuery: SSR'da server'da calisir, client'ta reactive olur
  const { data: posts } = useSuspenseQuery(
    convexQuery(api.posts.listPublished, { limit: 20 })
  );
  
  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </div>
  );
}
```

## Mutation Kullanimi

```typescript
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";

function CreatePostForm() {
  const createPost = useMutation({
    mutationFn: useConvexMutation(api.posts.create),
    onSuccess: (postId) => {
      navigate({ to: "/posts/$postId", params: { postId } });
    },
    onError: (error) => {
      if (error instanceof ConvexError) {
        toast.error(error.data.message);
      }
    },
  });
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createPost.mutate({ title, body });
      }}
    >
      {/* form fields */}
    </form>
  );
}
```

## Paralel Query

```typescript
function PostWithDetails({ postId }: { postId: Id<"posts"> }) {
  // Paralel — ayni anda baslar
  const [
    { data: post },
    { data: author },
    { data: comments },
  ] = useSuspenseQueries({
    queries: [
      convexQuery(api.posts.get, { postId }),
      convexQuery(api.users.getByPost, { postId }),
      convexQuery(api.comments.list, { postId }),
    ],
  });
  
  return (/* render */);
}
```

## Auth-Protected Route Pattern

```typescript
// src/routes/_auth/dashboard.tsx
export const Route = createFileRoute("/_auth/dashboard")({
  beforeLoad: async ({ context }) => {
    // Clerk auth check
    const auth = await getAuth();
    if (!auth.userId) throw redirect({ to: "/login" });
  },
  loader: async ({ context: { queryClient } }) => {
    // Authenticated data prefetch
    await queryClient.ensureQueryData(
      convexQuery(api.dashboard.getData, {})
    );
  },
  component: DashboardPage,
});
```

## Environment Variables

```bash
# .env.local
VITE_CONVEX_URL=https://project.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# .env.local (server-only — Vite prefix yok)
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://...clerk.accounts.dev
```

## Dev Script (package.json)

```json
{
  "scripts": {
    "dev": "concurrently \"npx convex dev\" \"vite dev\"",
    "build": "npx convex deploy && vite build",
    "start": "node .output/server/index.mjs"
  }
}
```
