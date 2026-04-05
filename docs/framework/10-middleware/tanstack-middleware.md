# TanStack Start Middleware

TanStack Start'ın `createMiddleware()` sistemi ile server-side request işleme.
Route bazında veya global olarak uygulanır.

---

## İki Middleware Türü

| Tür | Nerede | Ne İçin |
|-----|--------|---------|
| **Route middleware** | `beforeLoad` / `loader`'da | Route-spesifik auth, redirect |
| **Server middleware** | `createMiddleware()` | Global: auth, logging, headers |

---

## Server Middleware — `app/middleware/`

```
app/middleware/
├── auth.ts              # Clerk session → context
├── security.ts          # Security headers
├── request-id.ts        # Her isteğe benzersiz ID
└── index.ts             # Compose + export
```

### Auth Middleware

```typescript
// app/middleware/auth.ts
import { createMiddleware } from "@tanstack/start";
import { getAuth } from "@clerk/tanstack-start/server";
import { getWebRequest } from "vinxi/http";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getWebRequest();
  const auth = await getAuth(request);

  return next({
    context: {
      auth,          // { userId, sessionId, orgId, ... }
      isAuthenticated: !!auth.userId,
    },
  });
});
```

### Security Headers Middleware

```typescript
// app/middleware/security.ts
import { createMiddleware } from "@tanstack/start";

export const securityMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();

  // Güvenlik başlıkları
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  return response;
});
```

### Request ID Middleware

```typescript
// app/middleware/request-id.ts
import { createMiddleware } from "@tanstack/start";
import { nanoid } from "nanoid";

export const requestIdMiddleware = createMiddleware().server(async ({ next }) => {
  const requestId = nanoid(12);
  const response = await next({
    context: { requestId },
  });
  response.headers.set("X-Request-Id", requestId);
  return response;
});
```

---

## Route Bazında Middleware Kullanımı

```typescript
// app/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuth } from "@clerk/tanstack-start/server";
import { getWebRequest } from "vinxi/http";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    // context.auth authMiddleware'den gelir
    if (!context.auth.userId) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.pathname },
      });
    }
  },
  component: () => <Outlet />,
});
```

### Admin Route

```typescript
// app/routes/_admin.tsx
export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.userId) throw redirect({ to: "/sign-in" });

    // Convex'ten kullanıcı rolünü kontrol et
    const user = await context.convexQueryClient.fetchQuery(
      convexQuery(api.apps.users.usersChannel.getMe, {})
    );

    if (user?.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
```

---

## Router Context Tipleri

`app/router.tsx`'te context tiplerini genişlet:

```typescript
// app/router.tsx
import type { QueryClient } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { getAuth } from "@clerk/tanstack-start/server";

export interface RouterContext {
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
  auth: Awaited<ReturnType<typeof getAuth>>;
  isAuthenticated: boolean;
  requestId: string;
}

// Router'da context'i kullan
export function createRouter() {
  // ...
  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexClient,
      convexQueryClient,
      // auth + requestId middleware'den inject edilir
      auth: undefined!,
      isAuthenticated: false,
      requestId: "",
    },
  });
  // ...
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
```

---

## Server Functions Middleware

Server function'lar (createServerFn) için middleware:

```typescript
// app/lib/server-fn-middleware.ts
import { createMiddleware } from "@tanstack/start";
import { getAuth } from "@clerk/tanstack-start/server";
import { getWebRequest } from "vinxi/http";
import { errors } from "../../convex/lib/errors";

export const requireAuth = createMiddleware().server(async ({ next }) => {
  const auth = await getAuth(getWebRequest());
  if (!auth.userId) throw new Error(errors.unauthenticated().message);
  return next({ context: { auth } });
});
```

```typescript
// Kullanımı
export const myServerFn = createServerFn()
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { auth } = context;
    // auth.userId garantili
  });
```

---

## Middleware Sıralama

```typescript
// app/ssr.tsx
import { createStartHandler, defaultStreamHandler } from "@tanstack/start/server";
import { createRouter } from "./router";

export default createStartHandler({
  createRouter,
})(defaultStreamHandler);
```

Middleware'ler `__root.tsx`'deki `beforeLoad` zincirine ya da
server entry point'e eklenir. Sıra önemli:

```
requestIdMiddleware → authMiddleware → securityMiddleware
```

`requestId` ilk olmalı (logging için).
`auth` ikinci (context'e ekler).
`security` son (response'a başlık ekler).

---

## Rate Limiting (TanStack Middleware + Convex)

Convex rate limiter'ı TanStack route'larında kullanmak için server function:

```typescript
// app/lib/rate-limit.ts
import { createServerFn } from "@tanstack/start";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convexHttp = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);

export async function checkRouteRateLimit(userId: string, route: string) {
  // Convex action olarak rate limit kontrolü (auth gerektiriyor)
  // Bu pattern server function'dan çağrılır
}
```

**Not:** TanStack Start route'larında rate limiting için çoğunlukla
Convex'in kendi rate limiter'ı yeterlidir (channel layer'da).
TanStack middleware seviyesinde rate limiting yalnızca unauthenticated istekler için gerekir.
