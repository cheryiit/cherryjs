# Channel Katmanı

**Dosya:** `convex/apps/{domain}/{domain}.channel.ts`
**Convex türü:** `publicQuery` | `publicMutation` | `authenticatedQuery` | `authenticatedMutation` | `adminQuery` | `adminMutation`

---

## Sorumluluk

Channel, domain'in tek public API kapısıdır.
Client'tan yalnızca channel fonksiyonları çağrılabilir.
Tüm güvenlik kontrolleri (auth, rate limit) wrapper seçimiyle buraya gömülüdür.

---

## Katı Kurallar

1. **Sadece approved wrapper'lar** — `lib/functions.ts`'ten import
2. **20 satır handler limiti** — aşarsa business'a taşı
3. **Business logic yok** — if-else, hesaplama, DB query yok
4. **Her handler business'a delege eder**
5. **Input validasyonu Convex v.* ile** — Zod değil (performans)

---

## Wrapper Seçim Rehberi

```
Herkes erişebilir mi?     → publicQuery / publicMutation
Oturum açmış gerekir mi?  → authenticatedQuery / authenticatedMutation
Admin rolü gerekir mi?    → adminQuery / adminMutation
```

---

## Doğru Pattern

```typescript
// convex/apps/trading/trading.channel.ts
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import {
  authenticatedQuery,
  authenticatedMutation,
  adminQuery,
} from "../../lib/functions";

// ── Queries ──────────────────────────────────────────────────────────────────

export const listMine = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(internal.apps.trading.tradingBusiness.listByUser, {
      userId: ctx.user._id,
    });
  },
});

export const getById = authenticatedQuery({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    return ctx.runQuery(internal.apps.trading.tradingBusiness.getTradeForUser, {
      tradeId,
      userId: ctx.user._id,
    });
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = authenticatedMutation({
  args: {
    symbol: v.string(),
    side: v.union(v.literal("buy"), v.literal("sell")),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.apps.trading.tradingBusiness.createTrade, {
      userId: ctx.user._id,
      ...args,
    });
  },
});

export const cancel = authenticatedMutation({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    return ctx.runMutation(internal.apps.trading.tradingBusiness.cancelTrade, {
      tradeId,
      requestingUserId: ctx.user._id,
    });
  },
});
```

---

## Yanlış Pattern'ler

```typescript
// ❌ Business logic channel'da
export const cancel = authenticatedMutation({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const trade = await ctx.db.get(tradeId);        // ← MODEL işi
    if (trade?.userId !== ctx.user._id) throw ...;  // ← BUSINESS işi
    if (trade?.status !== "pending") throw ...;     // ← BUSINESS işi
    await ctx.db.patch(tradeId, { status: "cancelled" }); // ← MODEL işi
  },
});

// ❌ Raw query kullanımı
import { mutation } from "../../_generated/server"; // YASAK
export const cancel = mutation({ ... });

// ❌ Handler çok uzun (business logic sızdı)
export const complexOperation = authenticatedMutation({
  args: { ... },
  handler: async (ctx, args) => {
    // 50+ satır kod — bunların hepsi business'a ait
  },
});
```

---

## Pagination Pattern

```typescript
export const listMine = authenticatedQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return ctx.runQuery(internal.apps.trading.tradingBusiness.listByUserPaginated, {
      userId: ctx.user._id,
      paginationOpts,
    });
  },
});
```

---

## ctx.user Kullanımı

`authenticatedQuery/Mutation` wrapper'ları `ctx.user`'ı inject eder.
Bu tam `Doc<"users">` tipidir — tüm alanlarına erişilebilir.

```typescript
handler: async (ctx) => {
  ctx.user._id        // Id<"users">
  ctx.user.name       // string
  ctx.user.role       // "admin" | "user"
  ctx.user.isActive   // boolean
}
```

`adminQuery/Mutation` için `ctx.user.role === "admin"` garantilidir.
