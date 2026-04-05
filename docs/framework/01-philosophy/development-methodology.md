# Development Metodolojisi

CherryJS'te kod yazmak bir sırayı takip eder.
Bu sıra rastgele değil — her adım bir sonrakinin temelidir.

---

## Genel Yaklaşım: Contract-First Architecture-Driven Development

İki metodoloji birleştirilmiştir:

**Contract-First**: Schema ve tip tanımları, implementasyondan önce gelir.
**Architecture-Driven**: Architectural testler, yapıyı kod yazılmadan önce tanımlar.

Bunu şöyle özetleyebiliriz:
> "Önce sözleşmeyi yaz, sonra kuralları koy, sonra uygula."

---

## Backend Geliştirme Akışı

### Adım 1 — Schema (Kontrat)

Yeni bir domain başlatmadan önce `schema.ts`'e tablo tanımı eklenir.
Bu adım, domain'in "ne sakladığını" belirler.

```typescript
// convex/schema.ts
trades: defineTable({
  userId: v.id("users"),
  symbol: v.string(),
  side: literals("buy", "sell"),
  quantity: v.number(),
  price: v.number(),
  status: literals("pending", "filled", "cancelled"),
}).index("by_user", ["userId"]).index("by_status", ["status"]),
```

Tablo tanımı onaylanmadan **hiç kod yazılmaz**.
Schema değişikliği = breaking change = PR review gerektirir.

---

### Adım 2 — Model Layer

Tablonun ham DB operasyonlarını saran helper'lar yazılır.
Bunlar saf fonksiyonlardır — sadece `db` alır, logic içermez.

```typescript
// convex/model/trade.model.ts
export async function getTradeOrThrow(ctx: QueryCtx, tradeId: Id<"trades">) { ... }
export async function listTradesByUser(ctx: QueryCtx, userId: Id<"users">) { ... }
```

---

### Adım 3 — Architectural Test (Önce)

`tests/architecture.test.ts` dosyasına yeni domain için kurallar eklenir:

```typescript
it("trade domain: business katmanı raw mutation kullanmamalı", () => { ... });
it("trade domain: channel katmanı business logic içermemeli", () => { ... });
```

Bu testler implementasyon bitmeden **çalıştırılır ve fail verir** — bu beklenen durumdur.

---

### Adım 4 — Business Logic (TDD)

Business layer için önce test yazılır:

```typescript
// convex/apps/trade/trade.business.test.ts
test("createTrade: yetersiz bakiye varsa INSUFFICIENT_FUNDS hatası fırlatır", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    // setup...
    await expect(
      ctx.runMutation(internal.apps.trade.tradeBusiness.createTrade, { ... })
    ).rejects.toThrow(ErrorCode.INSUFFICIENT_FUNDS);
  });
});
```

Sonra implementasyon:

```typescript
// convex/apps/trade/trade.business.ts
export const createTrade = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    const balance = await getBalance(ctx, args.userId);
    if (balance < args.quantity * args.price) throw errors.insufficientFunds();
    // ...
  },
});
```

**Test → Implement → Green** döngüsü — business layer için zorunludur.

---

### Adım 5 — Channel Layer

Business logic tamamlanınca thin channel wrapper'ı yazılır.
Channel handler'ı **20 satırı geçmemeli** — geçiyorsa business'a taşı.

```typescript
// convex/apps/trade/trade.channel.ts
export const createTrade = authenticatedMutation({
  args: { symbol: v.string(), quantity: v.number(), price: v.number() },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.apps.trade.tradeBusiness.createTrade, {
      userId: ctx.user._id, ...args
    });
  },
});
```

---

### Adım 6 — Integration (Gerekirse)

Dış API çağrısı varsa integration layer eklenir, action-retrier ile sarılır.

---

## Frontend Geliştirme Akışı

### Prensip: Outside-In

UI'dan başla, veriyi sonra bağla.

### Adım 1 — Query Hook

```typescript
// app/features/trade/hooks/useMyTrades.ts
export function useMyTrades() {
  return useSuspenseQuery(convexQuery(api.apps.trade.tradeChannel.listMine, {}));
}
```

### Adım 2 — Component (Static → Dynamic)

Önce statik veriyle component yaz, sonra hook'u bağla.

```typescript
// app/features/trade/components/TradeList.tsx
export function TradeList() {
  const { data: trades } = useMyTrades();
  return <ul>{trades.map(t => <TradeItem key={t._id} trade={t} />)}</ul>;
}
```

### Adım 3 — Route (Thin)

Route sadece loader ve component'i bir araya getirir.

```typescript
// app/routes/_authenticated/trades.tsx
export const Route = createFileRoute("/_authenticated/trades")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(convexQuery(api.apps.trade.tradeChannel.listMine, {})),
  component: () => <TradeList />,
});
```

---

## Test Piramidi

```
        ┌──────────────┐
        │  E2E Tests   │  ← Az, yüksek değer (Playwright)
        ├──────────────┤
        │ Integration  │  ← Channel layer (convex-test)
        ├──────────────┤
        │  Unit Tests  │  ← Business layer (convex-test) — ÇOĞUNLUK
        ├──────────────┤
        │  Arch Tests  │  ← Dosya yapısı, import kuralları (Vitest, her commit)
        └──────────────┘
```

Architectural testler her commit'te çalışır — CI'da fail etmesi kabul edilmez.
Business unit testleri yeni domain eklenince yazılır — coverage %80 minimum.

---

## AI ile Geliştirme Kuralları

AI (Claude Code, Copilot vb.) ile kodlarken ilave kurallar:

1. **Her domain için tek seferlik scaffold** — AI bir kez domain skeleton'ı üretir, sonra küçük parçalar halinde çalışır
2. **Her AI session'ı architectural test'i çalıştırarak biter** — `pnpm test` green olmadan PR açılmaz
3. **AI'a "hangi katmana gidiyor?" sorusu sorulmaz** — konvansiyon dokümantasyonuna bakılır, karar verilir, sonra AI'a söylenir
4. **Şüpheliyse internal** — AI public mı internal mı diye sormaya gerek yok, varsayılan internal

---

## Özetle: Sıra

```
Schema → Model → Arch Test → Business Test → Business Impl → Channel → Frontend Hook → Route
```

Bu sıranın herhangi bir adımı atlanırsa, bir sonraki adımda teknik borç birikir.
