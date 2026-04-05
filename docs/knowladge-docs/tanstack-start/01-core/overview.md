# TanStack Start Overview

Kaynak: https://tanstack.com/start/latest/docs/framework/react/overview

## Nedir?

TanStack Start, **TanStack Router + Vite** uzerine insaa edilmis full-stack React framework'udur. Release Candidate asamasindadir (Nisan 2026 itibariyle).

## Temel Ozellikler

| Ozellik | Aciklama |
|---------|----------|
| **SSR** | Full-document server-side rendering + streaming |
| **Server Functions** | Type-safe client-server RPC |
| **File-Based Routing** | Otomatik route olusturma |
| **Middleware** | Request/response middleware zinciri |
| **API Routes** | Server-only HTTP endpoints |
| **Universal Deploy** | Vercel, Netlify, Cloudflare, Node.js |
| **Type Safety** | End-to-end TypeScript |

## TanStack Router Temeli

"90% of any framework usually comes down to the router."

TanStack Start, TanStack Router'in tum ozelliklerini alir ve bundle eder:
- Nested routing + layouts
- Type-safe route params + search params
- Data loading + preloading
- Error boundaries
- Suspense integration

## React Server Components

**RSC desteklenmiyor** (Nisan 2026 itibariyle). Aktif gelistirme suruyor.

**Convex icin bu sorun degil:** Convex'in veri modeli client-side reactive. RSC gerektirmiyor.

## Proje Yapisi

```
my-app/
├── src/
│   ├── routes/
│   │   ├── __root.tsx      # Root layout
│   │   ├── index.tsx       # / rotasi
│   │   ├── posts/
│   │   │   ├── index.tsx   # /posts
│   │   │   └── $postId.tsx # /posts/:postId
│   │   └── (auth)/         # Pathless layout group
│   │       └── login.tsx   # /login
│   ├── router.tsx          # Router config
│   ├── routeTree.gen.ts    # Auto-generated route tree
│   └── client.tsx          # Client entry
├── app.config.ts           # TanStack Start config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack (Framework'umuz icin)

```
TanStack Start (SSR + Routing)
├── TanStack Router (Type-safe routing)
├── Vite (Build tool)
├── TanStack Query (Data caching - Convex ile)
├── Convex (Backend - reactive database)
├── Clerk (Authentication)
├── Tailwind CSS v4 (Styling)
└── TypeScript (Type safety)
```

## Kurulum

```bash
# Yeni proje — Convex template
npm create convex@latest -- -t tanstack-start

# Manuel
npx gitpick TanStack/router/tree/main/examples/react/start-basic my-app
cd my-app
pnpm install
```

## Devtools

```typescript
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Root route'da
<TanStackRouterDevtools position="bottom-right" />
<ReactQueryDevtools buttonPosition="bottom-left" />
```
