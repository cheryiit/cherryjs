# Rate Limiter — Zorunlu Altyapı

`lib/rate-limiter.ts` — Tüm rate limit konfigürasyonları ve wrapper'lar bu dosyada.
Her channel mutation için rate limiting **zorunludur**. İstisna yok.

---

## Neden Zorunlu?

- Rate limiting olmayan mutation → DDoS/abuse vektörü
- Her mutation için ayrı limit tanımlamak yerine → named tier sistemi
- Architectural test, rate limit wrapper kullanmayan her channel mutation'ı **fail** eder

---

## lib/rate-limiter.ts — Tam İmplementasyon

```typescript
// convex/lib/rate-limiter.ts

import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {

  // ── Genel Mutation Tier'ları ────────────────────────────────────────────────

  /**
   * STRICT: Kritik işlemler — ödeme, sipariş, hesap değişikliği
   * 5 istek / dakika / kullanıcı
   */
  strict: {
    kind: "fixed window",
    rate: 5,
    period: 60_000, // 1 dakika
  },

  /**
   * NORMAL: Standart CRUD işlemleri
   * 30 istek / dakika / kullanıcı
   */
  normal: {
    kind: "fixed window",
    rate: 30,
    period: 60_000,
  },

  /**
   * RELAXED: Okuma ağırlıklı ya da düşük riskli operasyonlar
   * 100 istek / dakika / kullanıcı
   */
  relaxed: {
    kind: "fixed window",
    rate: 100,
    period: 60_000,
  },

  /**
   * BURST: Kısa süreli yoğun işlemler (toplu import, bulk edit)
   * Token bucket — burst'e izin verir ama uzun vadede throttle eder
   * Max 20 token, saniyede 2 token yenilenir
   */
  burst: {
    kind: "token bucket",
    rate: 2,        // saniyede 2 token
    capacity: 20,   // max burst
    period: 1_000,
  },

  // ── Domain-Spesifik Tier'lar ────────────────────────────────────────────────

  /**
   * AUTH: Login / register / şifre sıfırlama
   * 10 istek / 15 dakika / IP bazlı (key: IP)
   */
  "auth-ops": {
    kind: "fixed window",
    rate: 10,
    period: 900_000, // 15 dakika
  },

  /**
   * SEARCH: Arama operasyonları
   * 60 istek / dakika / kullanıcı
   */
  "search-ops": {
    kind: "fixed window",
    rate: 60,
    period: 60_000,
  },

  /**
   * FILE-UPLOAD: Storage upload URL üretimi
   * 10 istek / dakika / kullanıcı
   */
  "file-upload": {
    kind: "fixed window",
    rate: 10,
    period: 60_000,
  },

  /**
   * ADMIN-OPS: Admin panel operasyonları
   * 200 istek / dakika / admin
   */
  "admin-ops": {
    kind: "fixed window",
    rate: 200,
    period: 60_000,
  },

  /**
   * WEBHOOK: Webhook işleme (IP bazlı)
   * 500 istek / dakika / IP
   */
  "webhook-ingest": {
    kind: "fixed window",
    rate: 500,
    period: 60_000,
  },
});
```

---

## lib/functions.ts — Rate Limited Wrapper'lar

```typescript
// convex/lib/functions.ts — Rate limited wrapper tipleri

import { rateLimiter } from "./rate-limiter";
import { errors } from "./errors";

// ── Temel Rate Limited Wrapper'lar ────────────────────────────────────────────

/**
 * STRICT rate limiting: 5/dk — ödeme, sipariş, kritik işlemler
 */
export const strictMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "strict", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/**
 * NORMAL rate limiting: 30/dk — standart CRUD
 */
export const normalMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "normal", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/**
 * RELAXED rate limiting: 100/dk — düşük riskli operasyonlar
 */
export const relaxedMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "relaxed", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/**
 * BURST rate limiting: token bucket — toplu işlemler
 */
export const burstMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "burst", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/**
 * ADMIN rate limiting: 200/dk — admin operasyonları
 */
export const adminRateLimitedMutation = customMutation(adminMutation, {
  args: {},
  input: async (ctx) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "admin-ops", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return { ctx, args: {} };
  },
});

/**
 * PUBLIC STRICT: Auth gerektirmeyen ama rate limited (auth ops, signup)
 * Key olarak IP kullanılır — requestMeta'dan gelir
 */
export const publicStrictMutation = customMutation(publicMutation, {
  args: {
    _requestMeta: v.optional(v.object({
      userAgent: v.optional(v.string()),
      language: v.optional(v.string()),
      ip: v.optional(v.string()),
    })),
  },
  input: async (ctx, { _requestMeta }) => {
    const key = _requestMeta?.ip ?? "anonymous";
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "auth-ops", {
      key,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);
    return {
      ctx: { ...ctx, requestMeta: _requestMeta ?? null },
      args: {},
    };
  },
});
```

---

## Hangi Wrapper Ne Zaman

| Wrapper | Rate Limit | Kullanım Alanı |
|---------|-----------|----------------|
| `strictMutation` | 5/dk | Ödeme, sipariş, hesap silme |
| `normalMutation` | 30/dk | Standart create/update/delete |
| `relaxedMutation` | 100/dk | Düşük riskli update, preference |
| `burstMutation` | token bucket | Toplu import, bulk işlemler |
| `adminRateLimitedMutation` | 200/dk | Admin panel tüm işlemleri |
| `publicStrictMutation` | 10/15dk | Signup, login, şifre sıfırlama |
| `adminMutation` | — | Sadece RBAC; rate limit YOK → kullanma |
| `authenticatedMutation` | — | Sadece auth; rate limit YOK → kullanma |

> **Kural:** Channel mutation'larında `authenticatedMutation` ve `adminMutation` **doğrudan kullanılamaz**.
> Bu wrapper'lar yalnızca rate limited wrapper'ların base'i olarak zincirlenir.

---

## Approved Wrapper Listesi (Architectural Test Referansı)

```typescript
// Architectural testlerde bu liste kullanılır
export const APPROVED_CHANNEL_MUTATION_WRAPPERS = [
  "strictMutation",
  "normalMutation",
  "relaxedMutation",
  "burstMutation",
  "adminRateLimitedMutation",
  "publicStrictMutation",
  // Domain-spesifik rate limited wrapper'lar buraya eklenir:
  // "tradingMutation",
  // "paymentMutation",
] as const;

// Bu wrapper'lar channel'da KULLANILMAZ (rate limit yok):
export const INTERNAL_ONLY_WRAPPERS = [
  "authenticatedMutation",
  "adminMutation",
  "publicMutation",
] as const;
```

---

## Domain-Spesifik Rate Limited Wrapper

Bir domain'e özgü rate limit gerekiyorsa `lib/functions.ts`'e eklenir:

```typescript
// lib/functions.ts — domain-spesifik ekleme

// lib/rate-limiter.ts'e önce config eklenmeli:
// "trade-create": { kind: "fixed window", rate: 5, period: 60_000 }

export const tradingMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    // Trading-spesifik rate limit
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "trade-create", {
      key: ctx.user._id,
      throws: false,
    });
    if (!ok) throw errors.rateLimited(retryAfter);

    // Trading aktif mi?
    const tradingEnabled = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q: any) =>
        q.eq("domain", "trading").eq("key", "trading-enabled")
      )
      .first();
    if (tradingEnabled?.value === false) {
      throw errors.forbidden("Trading is temporarily disabled");
    }

    return { ctx, args: {} };
  },
});
```

Yeni wrapper oluştururken:
1. `lib/rate-limiter.ts`'e config ekle
2. `lib/functions.ts`'e wrapper ekle
3. `APPROVED_CHANNEL_MUTATION_WRAPPERS`'a ismi ekle
4. `docs/framework/11-shared-infrastructure/rate-limiter.md`'i güncelle

---

## errors.rateLimited()

```typescript
// lib/errors.ts'te tanımlı

export const errors = {
  // ...
  rateLimited: (retryAfter?: number) =>
    new ConvexError({
      code: ErrorCode.RATE_LIMITED,
      message: retryAfter
        ? `Too many requests. Retry after ${Math.ceil(retryAfter / 1000)}s`
        : "Too many requests",
      retryAfter,
    }),
};
```

Client, `retryAfter` (ms) değerini okuyup UI'da countdown gösterebilir.

---

## Architectural Test — Rate Limit Enforcement

```typescript
// tests/architectural/rate-limit-enforcement.test.ts

import { describe, it, expect } from "vitest";
import { glob } from "glob";
import * as fs from "fs";

const APPROVED_WRAPPERS = [
  "strictMutation",
  "normalMutation",
  "relaxedMutation",
  "burstMutation",
  "adminRateLimitedMutation",
  "publicStrictMutation",
];

// Rate limit olmayan wrapper'lar — channel'da export'ta kullanılamaz
const FORBIDDEN_IN_CHANNEL_EXPORTS = [
  "authenticatedMutation(",
  "adminMutation(",
  "publicMutation(",
];

describe("Rate Limit Enforcement", () => {
  const channelFiles = glob.sync("convex/apps/**/*.channel.ts");

  it("should have at least one channel file", () => {
    expect(channelFiles.length).toBeGreaterThan(0);
  });

  channelFiles.forEach((file) => {
    describe(`${file}`, () => {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      // export satırlarını bul (export const X = someWrapper({)
      const exportLines = lines
        .map((line, i) => ({ line, lineNum: i + 1 }))
        .filter(({ line }) => /^export const \w+ =/.test(line.trim()));

      exportLines.forEach(({ line, lineNum }) => {
        it(`line ${lineNum}: exported function must use approved rate-limited wrapper`, () => {
          // export const foo = normalMutation({ ... }) şeklinde başlamalı
          const usesApproved = APPROVED_WRAPPERS.some((w) =>
            line.includes(`= ${w}(`)
          );

          // cherry:allow yorumuyla bypass edilebilir (public health check vb.)
          const isBypassed = content
            .split("\n")
            .slice(Math.max(0, lineNum - 3), lineNum + 1)
            .some((l) => l.includes("// cherry:allow-no-rate-limit"));

          if (!isBypassed) {
            expect(usesApproved).toBe(true);
          }
        });
      });

      it("should not use forbidden wrappers in exports", () => {
        const violations: string[] = [];

        exportLines.forEach(({ line, lineNum }) => {
          const usesForbidden = FORBIDDEN_IN_CHANNEL_EXPORTS.some((w) =>
            line.includes(`= ${w}`)
          );
          if (usesForbidden) {
            violations.push(`Line ${lineNum}: ${line.trim()}`);
          }
        });

        expect(violations).toEqual([]);
      });
    });
  });
});
```

### Bypass Mekanizması

```typescript
// Nadir durumlarda (health check, public ping) bypass:
// cherry:allow-no-rate-limit
export const healthCheck = publicQuery({ // query'ler muaf — sadece mutation kontrol edilir
  args: {},
  handler: async () => ({ ok: true }),
});
```

> Sadece `mutation`'lar enforce edilir. `query`'ler rate limit zorunluluğundan muaftır.
> Ancak yüksek maliyetli query'ler için manuel `rateLimiter.limit()` çağrısı yapılabilir.
