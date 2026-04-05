# TanStack Start Middleware

Kaynak: https://tanstack.com/start/latest/docs/framework/react/guide/middleware

## Iki Middleware Tipi

| Tip | Kapsam | Kullanim |
|-----|--------|---------|
| **Request Middleware** | Tum server requestleri (SSR + server functions) | Logging, CORS, security headers |
| **Server Function Middleware** | Sadece server functions | Auth check, context enrichment, input transform |

**Kural:** Request middleware, server function middleware'den bagimsizdir. Ama server function middleware, request middleware'e bagimli olabilir.

## createMiddleware

```typescript
// src/middleware/auth.ts
import { createMiddleware } from "@tanstack/react-start";
import { getAuth } from "@clerk/tanstack-start/server";

export const authMiddleware = createMiddleware()
  .server(async ({ next, context }) => {
    const auth = await getAuth();
    
    if (!auth.userId) {
      throw redirect({ to: "/login" });
    }
    
    // next() ile context zenginlestir
    return next({
      context: {
        ...context,
        userId: auth.userId,
      },
    });
  });
```

## Logger Middleware

```typescript
export const loggerMiddleware = createMiddleware()
  .server(async ({ next, request }) => {
    const start = Date.now();
    const result = await next();
    const duration = Date.now() - start;
    
    console.log(`${request.method} ${request.url} - ${duration}ms`);
    return result;
  });
```

## Server Function'da Middleware Kullanimi

```typescript
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, loggerMiddleware } from "../middleware";

export const updatePost = createServerFn()
  .middleware([loggerMiddleware, authMiddleware]) // Sirayla calisir
  .validator(
    z.object({
      postId: z.string(),
      title: z.string(),
    })
  )
  .handler(async ({ data, context }) => {
    // context.userId authMiddleware'den geliyor
    await db.posts.update(data.postId, {
      title: data.title,
      updatedBy: context.userId,
    });
  });
```

## Rate Limiting Middleware

```typescript
export const rateLimitMiddleware = createMiddleware()
  .server(async ({ next, context }) => {
    const ip = context.request.headers.get("x-forwarded-for") ?? "unknown";
    
    const { ok } = await checkRateLimit(ip);
    if (!ok) {
      throw new Response("Too Many Requests", { status: 429 });
    }
    
    return next();
  });
```

## Security Headers Middleware

```typescript
export const securityMiddleware = createMiddleware()
  .server(async ({ next }) => {
    const result = await next();
    
    // Response'a security headers ekle
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("X-Frame-Options", "DENY");
    result.headers.set("X-XSS-Protection", "1; mode=block");
    
    return result;
  });
```

## Global Middleware (app.config.ts)

```typescript
// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";

export default defineConfig({
  tsr: {
    // TanStack Router config
  },
  server: {
    middleware: ["./src/middleware/global.ts"],
  },
});
```

## Convex ile Middleware Kullanimi

Convex auth Convex kendi sistemiyle yonetilir. TanStack middleware daha cok:
- Request logging
- Security headers
- Non-Convex server function auth
- CORS (HTTP actions duzeyinde)

```typescript
// Non-Convex path icin middleware
export const convexAuthMiddleware = createMiddleware()
  .server(async ({ next, context }) => {
    // Clerk'ten user al — Convex provider'ine vermek icin
    const auth = await getAuth();
    return next({
      context: {
        ...context,
        clerkUserId: auth.userId,
        isAuthenticated: !!auth.userId,
      },
    });
  });
```
