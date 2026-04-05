# Integration Katmanı

**Dosya:** `convex/apps/{domain}/{domain}.integration.ts`
**Convex türü:** `internalAction` (sadece)

---

## Sorumluluk

Dış dünya ile iletişim.
HTTP istekleri, webhook'lar, 3rd party SDK çağrıları.
DB'ye doğrudan erişim YOKTUR.

---

## Katı Kurallar

1. **Sadece `internalAction`** — mutation veya query değil
2. **DB erişimi yok** — `ctx.db` kullanılamaz
3. **Okuma gerekirse** → `ctx.runQuery(internal...business...)` ile
4. **Yazma gerekirse** → `ctx.runMutation(internal...business...)` ile
5. **Tüm harici hatalar yakalanır** ve `errors.*` ile yeniden fırlatılır
6. **Idempotent tasarım** — aynı input ile tekrar çağrılabilmeli
7. **Retry için action-retrier** kullanılır (gerekirse)

---

## Doğru Pattern

```typescript
// convex/apps/trading/trading.integration.ts
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";

export const submitToExchange = internalAction({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    // DB okuma → business'tan
    const trade = await ctx.runQuery(
      internal.apps.trading.tradingBusiness.getTradeById, { tradeId }
    );
    if (!trade) throw errors.notFound("Trade");

    // Dış API çağrısı
    let response: Response;
    try {
      response = await fetch("https://exchange.example.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EXCHANGE_API_KEY}`,
        },
        body: JSON.stringify({
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
        }),
      });
    } catch (e) {
      throw errors.internal("Exchange API'ye bağlanılamadı");
    }

    if (!response.ok) {
      const body = await response.text();
      throw errors.internal(`Exchange reddetti: ${body}`);
    }

    const { orderId, executedPrice } = await response.json();

    // DB yazma → business'a delege et
    await ctx.runMutation(
      internal.apps.trading.tradingBusiness.confirmExchangeOrder,
      { tradeId, orderId, executedPrice }
    );
  },
});
```

---

## Action Retrier ile Güvenilirlik

Dış API çağrıları başarısız olabilir. `@convex-dev/action-retrier` kullanımı:

```typescript
// convex/lib/retrier.ts
import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

export const retrier = new ActionRetrier(components.actionRetrier);
```

```typescript
// Business katmanında schedule yerine retrier kullan
export const createTrade = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    const tradeId = await ctx.db.insert("trades", { ... });

    // Retry ile güvenilir execution
    await retrier.run(ctx, internal.apps.trading.tradingIntegration.submitToExchange, {
      tradeId,
    });

    return tradeId;
  },
});
```

---

## Webhook Handler Pattern

Gelen webhook'ları http.ts'te Hono ile al, ardından integration veya doğrudan business'a ilet:

```typescript
// convex/http.ts
app.post("/webhooks/exchange", async (c) => {
  const body = await c.req.json();
  const signature = c.req.header("x-signature");

  // Signature verification
  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  await c.env.runMutation(
    internal.apps.trading.tradingBusiness.processExchangeWebhook,
    { event: body }
  );

  return c.json({ ok: true });
});
```

Webhook handler'lar `internalMutation`'da işlenir — idempotency key ile.

---

## Environment Variables

Integration katmanı, dış API key'lerini `process.env` ile alır.
Convex dashboard'da "Environment Variables" altında tanımlanır.

```typescript
const apiKey = process.env.EXCHANGE_API_KEY;
if (!apiKey) throw errors.internal("EXCHANGE_API_KEY tanımlı değil");
```

---

## Ne Zaman Integration Katmanı Gerekmez?

- Sadece DB operasyonu → business katmanı yeterli
- Convex built-in özellik (file storage, scheduler) → business'ta kullanılır
- Sadece Convex components (@convex-dev/*) → business'ta kullanılır
