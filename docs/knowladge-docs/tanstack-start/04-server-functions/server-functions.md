# TanStack Start Server Functions

Kaynak: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

## Nedir?

`createServerFn` ile olusturulan, **server'da calisip client'tan cagrilabilen** fonksiyonlar. tRPC benzeri ama framework built-in.

**Convex ile kullanim:** Convex tum backend'i karsilediği icin server functions minimal kullanilir — auth redirect, middleware, Convex-disı server islemleri icin.

## Temel Yapı

```typescript
// src/server/posts.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getServerPost = createServerFn()
  .validator(z.object({ postId: z.string() }))
  .handler(async ({ data }) => {
    // Bu kod server'da calisir
    // process.env, Node.js API'leri kullanilabilir
    const post = await db.posts.findById(data.postId);
    return post;
  });

// Client'tan cagirma
const post = await getServerPost({ postId: "123" });
```

## use server Direktifi

```typescript
// Server-only kod — client bundle'a dahil edilmez
"use server";

import { createServerFn } from "@tanstack/react-start";

export const createPost = createServerFn()
  .validator(
    z.object({
      title: z.string().min(3),
      body: z.string().min(10),
    })
  )
  .handler(async ({ data }) => {
    // process.env.DATABASE_URL gibi secrets kullanilabilir
    await db.posts.create(data);
    return { success: true };
  });
```

## Middleware ile Server Function

```typescript
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../middleware/auth";

export const createPost = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({ title: v.string(), body: z.string() })
  )
  .handler(async ({ data, context }) => {
    // context.user middleware'den geliyor
    await db.posts.create({ ...data, userId: context.user.id });
  });
```

## Loader'da Kullanım

```typescript
export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params }) => {
    // Server function loader'da cagrilabilir
    return getServerPost({ postId: params.postId });
  },
  component: PostPage,
});
```

## Convex vs Server Functions

```
Convex kullan:
- Tum veri okuma/yazma
- Real-time subscriptions
- Auth-protected operations

Server Functions kullan:
- Convex-disı server islemleri
- Auth redirect (Clerk session check)
- Ozel middleware logic
- Node.js-only kutuphaneler
```

## Ornek: Auth Redirect

```typescript
// src/server/auth.ts
export const requireAuth = createServerFn()
  .handler(async () => {
    const session = await getClerkSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return session;
  });

// Route'da kullanim
export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    await requireAuth();
  },
  component: Dashboard,
});
```
