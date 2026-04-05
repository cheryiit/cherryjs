# Convex Components

Kaynak: https://docs.convex.dev/components/using-components

## Nedir?

Convex Components kendi functions, schema, data ve scheduled operations'a sahip **izole sandbox'lar**dir. npm'den kurulup projeye eklenir.

## Kurulum

### 1. npm Paketi Kur

```bash
pnpm add @convex-dev/rate-limiter
```

### 2. convex.config.ts'e Kaydet

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import actionCache from "@convex-dev/action-cache/convex.config.js";

const app = defineApp();
app.use(rateLimiter);
app.use(actionCache);

// Ayni component'i birdden fazla kullanmak icin
app.use(rateLimiter, { name: "authRateLimiter" });
app.use(rateLimiter, { name: "apiRateLimiter" });

export default app;
```

### 3. Kod Uret

```bash
npx convex dev
```

### 4. API'yi Kullan

```typescript
// convex/lib/rateLimiter.ts
import { components } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  login: { kind: "fixed window", rate: 10, period: MINUTE },
  api: { kind: "token bucket", rate: 100, period: MINUTE, capacity: 200 },
});
```

## Transaction Davranisi

```
Top-level Mutation (atomik)
├── Component Mutation A ✓
├── Component Mutation B ✓
└── App Mutation ✓
    ↓ Hepsi birlikte commit veya rollback
```

Component mutation hata firlatirsa:
- Sadece o component'in yazmalari rollback
- Parent mutation devam edebilir (try/catch ile)

## Onemli Component'ler

### Rate Limiter
```bash
pnpm add @convex-dev/rate-limiter
```
Login throttling, API rate limiting, abuse prevention.

### Action Cache
```bash
pnpm add @convex-dev/action-cache
```
Pahalı action sonuçlarını (AI calls, external API) cache'le.

### Action Retrier
```bash
pnpm add @convex-dev/action-retrier
```
Basarisiz action'lari exponential backoff ile retry et.

### Aggregate
```bash
pnpm add @convex-dev/aggregate
```
O(log n) count/sum aggregation — table scan olmadan.

### Crons (Dynamic)
```bash
pnpm add @convex-dev/crons
```
Runtime'da dinamik cron kayit/iptal.

### AI Agent
```bash
pnpm add @convex-dev/agent
```
Persistent message threads, tool calling, RAG.

### Better Auth
```bash
pnpm add @convex-dev/better-auth
```
Framework-agnostic auth (React, Vue, Svelte, Next.js).

## Test Ortaminda Kullanim

```typescript
// tests/setup.ts
import { convexTest } from "convex-test";
import { components } from "./_generated/api";

const t = convexTest(schema);

// Component'leri test ortaminda kaydet
// (Component'e gore degisir)
```

## Dashboard'da Izleme

Convex Dashboard → Component dropdown:
- Her component'in tablosunu goruntule
- Function loglarini filtrele
- File storage'i incele
