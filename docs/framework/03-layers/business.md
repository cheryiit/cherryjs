# Business Katmanı

**Dosya:** `convex/apps/{domain}/{domain}.business.ts`
**Convex türü:** `internalMutation` | `internalQuery` (sadece)

---

## Sorumluluk

Tüm business logic buradadır.
Domain kuralları, validasyonlar, karar mantığı, state geçişleri.
Test edilebilirliğin merkezi bu katmandır.

---

## Katı Kurallar

1. **Sadece `internalMutation` ve `internalQuery`** — public builder yasak
2. **Tüm if-else business kuralları burada** — başka katmanda olamaz
3. **Model helper'larını kullan** — ham `ctx.db.query` yerine
4. **Unit test zorunlu** — her internalMutation için en az 1 happy + 1 error path testi
5. **50 satır handler limiti** — aşarsa yardımcı fonksiyon çıkar veya split et
6. **throw sadece `errors.*` ile** — `new Error()` yasak

---

## Import Kuralları

```typescript
// ✅ İzin verilen import'lar
import { internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import { hasPermission, Permission } from "../../lib/permissions";
import { getTradeById, listTradesByUser } from "../../model/trade.model";
import type { Id, Doc } from "../../_generated/dataModel";

// ❌ Yasak import'lar
import { query, mutation } from "../../_generated/server";  // public builder
import { authenticatedMutation } from "../../lib/functions"; // channel'a ait
```

---

## Doğru Pattern

```typescript
// convex/apps/trading/trading.business.ts
import { internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import { getTradeById, listTradesByUser } from "../../model/trade.model";
import type { Id } from "../../_generated/dataModel";

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return listTradesByUser(ctx, userId);
  },
});

export const getTradeForUser = internalQuery({
  args: { tradeId: v.id("trades"), userId: v.id("users") },
  handler: async (ctx, { tradeId, userId }) => {
    const trade = await getTradeById(ctx, tradeId);
    if (!trade) throw errors.notFound("Trade");
    if (trade.userId !== userId) throw errors.forbidden();
    return trade;
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const createTrade = internalMutation({
  args: {
    userId: v.id("users"),
    symbol: v.string(),
    side: v.union(v.literal("buy"), v.literal("sell")),
    quantity: v.number(),
  },
  handler: async (ctx, { userId, symbol, side, quantity }) => {
    // Business rule: Aynı sembol için açık trade varsa yeni trade açılamaz
    const existing = await ctx.db
      .query("trades")
      .withIndex("by_user_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) throw errors.conflict("Bu sembol için zaten açık bir trade var");

    const tradeId = await ctx.db.insert("trades", {
      userId,
      symbol,
      side,
      quantity,
      status: "pending",
      createdAt: Date.now(),
    });

    // Side effect: exchange'e gönder
    await ctx.scheduler.runAfter(0, internal.apps.trading.tradingIntegration.submitToExchange, {
      tradeId,
    });

    return tradeId;
  },
});

export const cancelTrade = internalMutation({
  args: {
    tradeId: v.id("trades"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, { tradeId, requestingUserId }) => {
    const trade = await getTradeById(ctx, tradeId);
    if (!trade) throw errors.notFound("Trade");
    if (trade.userId !== requestingUserId) throw errors.forbidden();
    if (trade.status !== "pending") {
      throw errors.conflict("Yalnızca bekleyen trade'ler iptal edilebilir");
    }

    await ctx.db.patch(tradeId, { status: "cancelled", cancelledAt: Date.now() });
  },
});
```

---

## State Machine Pattern (Durum Geçişleri)

Durum geçişleri business katmanında bir fonksiyonla yönetilir:

```typescript
const VALID_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  pending:   ["filled", "cancelled", "rejected"],
  filled:    [],
  cancelled: [],
  rejected:  [],
};

function assertValidTransition(from: TradeStatus, to: TradeStatus) {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw errors.conflict(`${from} → ${to} geçişi geçersiz`);
  }
}

export const updateStatus = internalMutation({
  args: { tradeId: v.id("trades"), newStatus: v.string() },
  handler: async (ctx, { tradeId, newStatus }) => {
    const trade = await getTradeById(ctx, tradeId);
    if (!trade) throw errors.notFound("Trade");
    assertValidTransition(trade.status as TradeStatus, newStatus as TradeStatus);
    await ctx.db.patch(tradeId, { status: newStatus });
  },
});
```

---

## Test Zorunluluğu

Her `internalMutation` için:

```
✅ Happy path — başarılı senaryo
✅ Not found error — kaynak yoksa
✅ Forbidden error — yetkisiz erişim
✅ Business rule violation — domain kuralı ihlali
```

Dosya: `convex/apps/{domain}/{domain}.business.test.ts`

Test için `convex-test` package kullanılır.

```typescript
import { convexTest } from "convex-test";
import schema from "../../schema";
import { test, expect } from "vitest";
import { internal } from "../../_generated/api";

test("cancelTrade: pending olmayan trade iptal edilemez", async () => {
  const t = convexTest(schema);

  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { ... });
    const tradeId = await ctx.db.insert("trades", {
      userId,
      status: "filled",
      ...
    });

    await expect(
      ctx.runMutation(internal.apps.trading.tradingBusiness.cancelTrade, {
        tradeId,
        requestingUserId: userId,
      })
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });
});
```
