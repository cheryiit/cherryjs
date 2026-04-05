# TanStack Router Search Params

Kaynak: https://tanstack.com/router/latest

## Nedir?

URL search params (`?key=value`) TanStack Router'da **type-safe** ve **validated** sekilde yonetilir. Zod veya Valibot ile validate edilebilir.

## Temel Kullanim

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "published", "all"]).default("all"),
  query: z.string().optional(),
});

export const Route = createFileRoute("/posts")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PostsPage,
});

function PostsPage() {
  const { page, limit, status, query } = Route.useSearch();
  // Tum alanlar type-safe!
  
  return (
    <div>
      <p>Page: {page}</p>
    </div>
  );
}
```

## Search Params Guncelleme

```typescript
import { useNavigate, Link } from "@tanstack/react-router";

function PostFilter() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  
  return (
    <div>
      {/* Navigate ile */}
      <button
        onClick={() =>
          navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
        }
      >
        Next Page
      </button>
      
      {/* Link ile */}
      <Link
        to="/posts"
        search={{ status: "published", page: 1 }}
      >
        Published Posts
      </Link>
    </div>
  );
}
```

## Convex ile Entegrasyon

```typescript
export const Route = createFileRoute("/posts")({
  validateSearch: searchSchema.parse,
  
  // Loader'da search params kullan
  loader: async ({ context: { queryClient }, search }) => {
    await queryClient.prefetchQuery(
      convexQuery(api.posts.list, {
        status: search.status,
        limit: search.limit,
      })
    );
  },
  
  component: PostsPage,
});

function PostsPage() {
  const { status, page, limit } = Route.useSearch();
  
  const { data } = useSuspenseQuery(
    convexQuery(api.posts.list, { status, limit })
  );
  
  return (/* render */);
}
```

## Default Values

```typescript
const searchSchema = z.object({
  // .default() ile URL'de yoksa varsayilan deger
  page: z.number().default(1),
  tab: z.enum(["overview", "details"]).default("overview"),
});

// URL: /posts → page=1, tab="overview"
// URL: /posts?page=2 → page=2, tab="overview"
```

## Type-Safe Link

```typescript
// Compile-time hata verirse yanlis param gecildi
<Link
  to="/posts"
  search={{
    page: 1,        // number ✅
    status: "all",  // enum ✅
  }}
>
  Posts
</Link>
```
