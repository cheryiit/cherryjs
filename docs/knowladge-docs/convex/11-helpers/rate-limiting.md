# Convex Rate Limiting

Kaynak: https://stack.convex.dev/rate-limiting

## Iki Pattern

### 1. Token Bucket (Sliding Window)
Surekli token yenilenir. Burst traffic'e izin verir, ortalama rate'i korur.
- **Kullanim:** Genel API limitleri

### 2. Fixed Window
Sabit aralikta token yenilenir.
- **Kullanim:** 3rd party API limitleri (saat basinda reset), billing limitleri

## Kurulum — Component (Onerilen)

```bash
pnpm add @convex-dev/rate-limiter
```

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();
app.use(rateLimiter);
export default app;
```

```typescript
// convex/lib/rateLimiter.ts
import { components } from "./_generated/api";
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Auth rate limits
  login: {
    kind: "fixed window",
    rate: 10,              // 10 deneme
    period: MINUTE * 15,  // 15 dakikada
  },
  
  // API rate limits
  api: {
    kind: "token bucket",
    rate: 100,             // 100 istek
    period: MINUTE,        // dakika basina
    capacity: 200,         // max burst
  },
  
  // AI kullanim limiti
  aiGeneration: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
  },
  
  // Kullanici basina mesaj
  messaging: {
    kind: "fixed window",
    rate: 50,
    period: HOUR,
  },
});
```

## Kullanim

```typescript
// convex/functions/auth.ts
import { rateLimiter } from "../lib/rateLimiter";
import { mutation } from "./_generated/server";

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    // IP veya email'e gore rate limit
    const { ok, retryAfter } = await rateLimiter.limit(
      ctx,
      "login",
      { key: email, throws: false }
    );
    
    if (!ok) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        retryAfter,
        message: `Cok fazla deneme. ${retryAfter} ms sonra tekrar deneyin.`,
      });
    }
    
    // Normal login logic...
  },
});
```

### throws: true ile (otomatik error)

```typescript
export const generateAI = authenticatedMutation({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    // Otomatik ConvexError firlatir
    await rateLimiter.limit(ctx, "aiGeneration", {
      key: ctx.user._id,
      throws: true,
    });
    
    // Devam...
  },
});
```

## Rezervasyon Pattern'i

```typescript
// Pahalı operasyon oncesi slot rezerve et
const { ok, id } = await rateLimiter.reserve(ctx, "aiGeneration", {
  key: userId,
});

if (!ok) {
  throw new ConvexError({ code: "RATE_LIMITED" });
}

// Rezervasyon ID ile sonraki islem garantili
await ctx.scheduler.runAfter(0, internal.ai.generate, {
  reservationId: id,
  prompt,
});
```

## Custom Functions ile Entegrasyon

```typescript
// convex/lib/functions.ts
export const rateLimitedMutation = customMutation(
  mutation,
  {
    args: {},
    input: async (ctx, args) => {
      const user = await getCurrentUser(ctx);
      if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
      
      await rateLimiter.limit(ctx, "api", {
        key: user._id,
        throws: true,
      });
      
      return { ctx: { ...ctx, user }, args: {} };
    },
  }
);
```
