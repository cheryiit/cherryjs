# TanStack Start File-Based Routing

Kaynak: https://tanstack.com/router/latest

## Nasil Calisir?

`src/routes/` klasorunuzdeki dosyalar otomatik olarak route'lara donusur. Kod uretici (`@tanstack/router-plugin`) `routeTree.gen.ts` dosyasini otomatik olusturur.

## Dosya Adlandirma Kurallari

| Dosya | URL | Aciklama |
|-------|-----|----------|
| `__root.tsx` | / (layout) | Root layout — tum sayfalara uygulanir |
| `index.tsx` | `/` | Ana sayfa |
| `about.tsx` | `/about` | Statik route |
| `posts/index.tsx` | `/posts` | Klasor index route |
| `posts/$postId.tsx` | `/posts/:postId` | Dynamic route |
| `posts_.$postId.tsx` | `/posts/:postId` | Flat file ile dynamic |
| `(auth)/login.tsx` | `/login` | Pathless group (layout icin) |
| `_layout.tsx` | Layout only | Pathless layout |
| `posts.tsx` | Layout | Post sayfalarinin layout'u |

## Root Route

```typescript
// src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Outlet,
  ScrollRestoration,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => <div>404 - Not Found</div>,
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

function RootComponent() {
  return (
    <html>
      <head />
      <body>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/posts">Posts</Link>
        </nav>
        <Outlet />
        <ScrollRestoration />
        <TanStackRouterDevtools position="bottom-right" />
      </body>
    </html>
  );
}
```

## Index Route

```typescript
// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: posts } = useSuspenseQuery(
    convexQuery(api.posts.listPublished, {})
  );

  return (
    <div>
      {posts.map((post) => (
        <div key={post._id}>{post.title}</div>
      ))}
    </div>
  );
}
```

## Dynamic Route

```typescript
// src/routes/posts/$postId.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ context: { queryClient }, params: { postId } }) => {
    // Data prefetch
    const post = await queryClient.ensureQueryData(
      convexQuery(api.posts.get, { postId })
    );
    if (!post) throw notFound();
  },
  component: PostPage,
  notFoundComponent: () => <div>Post not found</div>,
});

function PostPage() {
  const { postId } = Route.useParams();
  const { data: post } = useSuspenseQuery(
    convexQuery(api.posts.get, { postId })
  );

  return <article>{post.title}</article>;
}
```

## Nested Layouts

```typescript
// src/routes/dashboard.tsx — Layout route
export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Outlet />  {/* Nested routes burada render */}
      </main>
    </div>
  );
}

// src/routes/dashboard/index.tsx
export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});
```

## Pathless Layout Groups

```typescript
// src/routes/_auth.tsx — URL'de gorunmez, sadece layout
export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    // Auth check
  },
  component: () => <Outlet />,
});

// src/routes/_auth/settings.tsx → /settings
// src/routes/_auth/profile.tsx → /profile
```

## Link Komponenti

```typescript
import { Link } from "@tanstack/react-router";

// Type-safe navigation
<Link to="/posts/$postId" params={{ postId: post._id }}>
  {post.title}
</Link>

// Active state
<Link
  to="/dashboard"
  activeProps={{ className: "font-bold text-blue-600" }}
  inactiveProps={{ className: "text-gray-600" }}
>
  Dashboard
</Link>

// Search params
<Link
  to="/posts"
  search={{ page: 1, filter: "published" }}
>
  Posts
</Link>
```

## Navigate (Programmatic)

```typescript
import { useNavigate } from "@tanstack/react-router";

function Component() {
  const navigate = useNavigate();

  const handleCreate = async () => {
    const id = await createPost({ title: "New Post" });
    navigate({ to: "/posts/$postId", params: { postId: id } });
  };
}
```

## routeTree.gen.ts

Bu dosya **otomatik olusturulur** — elle duzenleme yapma:

```bash
# Development'ta otomatik guncellenir
pnpm dev

# Veya manuel olustur
npx tsr generate
```
