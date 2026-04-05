# TanStack Start Knowledge Base

Framework'umuz icin toplanan TanStack Start + TanStack Router dokumantasyonu.

## Klasor Yapisi

### 01-core — Genel Bakis
- `overview.md` — Platform mimarisi, ozellikler, proje yapisi

### 02-routing — Routing
- `file-based-routing.md` — Dosya adlandirma, route tipleri, Link, navigate
- `search-params.md` — URL state, Zod validation, type-safe search

### 03-data-loading — Veri Yukleme
- `loaders.md` — loader fonksiyonu, beforeLoad, pending/error component, preloading

### 04-server-functions — Server Fonksiyonlari
- `server-functions.md` — createServerFn, validator, Convex vs server functions

### 05-middleware — Middleware
- `middleware.md` — createMiddleware, request middleware, server function middleware

### 06-auth — Kimlik Dogrulama
- `clerk-integration.md` — Clerk kurulum, protected routes, auth hooks

### 07-convex-integration — Convex Entegrasyonu (EN ONEMLI)
- `convex-tanstack.md` — router.tsx kurulumu, ConvexQueryClient, useSuspenseQuery

### 08-deployment — Deployment
- `deployment.md` — Vercel/Netlify/Cloudflare, CI/CD, checklist

## Hizli Referans

### Kritik Dosyalar

1. `07-convex-integration/convex-tanstack.md` — Entegrasyon kurulumu
2. `02-routing/file-based-routing.md` — Route yapisi
3. `06-auth/clerk-integration.md` — Auth kurulumu
4. `03-data-loading/loaders.md` — SSR data loading
5. `05-middleware/middleware.md` — Middleware pattern

### Tech Stack

```
TanStack Start ^1.167+
TanStack Router ^1.168+
@convex-dev/react-query (Convex + React Query bridge)
@tanstack/react-query ^5
@clerk/tanstack-start
convex ^1.19+
React 19
Vite 8+
TypeScript 6+
Tailwind CSS v4
Zod v3
```

### Onemli Paketler

```bash
pnpm add @tanstack/react-start @tanstack/react-router
pnpm add convex @convex-dev/react-query @tanstack/react-query
pnpm add @clerk/tanstack-start
pnpm add -D @tanstack/react-router-devtools @tanstack/react-query-devtools
```

### Kaynaklar

- Start Docs: https://tanstack.com/start/latest/docs
- Router Docs: https://tanstack.com/router/latest/docs
- Convex + TanStack: https://docs.convex.dev/client/react/tanstack-start
- Ornek Proje: https://github.com/TanStack/router/tree/main/examples/react/start-convex-trellaux
