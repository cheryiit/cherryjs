# Yeni Integration Ekleme

Mevcut bir domain'e dış API entegrasyonu ekleme rehberi.
Örnek: `trading` domain'ine bir exchange API entegre ediyoruz.

---

## Ön Koşul Kontrol

- [ ] Hangi domain'e ait? → `trading`
- [ ] Sadece bu domain mi kullanacak? → Evet → domain'in integration dosyasına
- [ ] Birden fazla domain kullanacak mı? → `lib/integrations/` shared helper

---

## Adım 1 — Environment Variable Ekle

```bash
# .env.example'a ekle
EXCHANGE_API_KEY=your_key_here
EXCHANGE_BASE_URL=https://api.exchange.example.com
```

Convex dashboard → Settings → Environment Variables → Yeni değişken ekle.

---

## Adım 2 — Integration Dosyasını Oluştur veya Genişlet

Dosya varsa: `convex/apps/trading/trading.integration.ts`
Yoksa: yeni oluştur (sadece `internalAction` kullanacaksın)

```typescript
// convex/apps/trading/trading.integration.ts
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";

export const submitToExchange = internalAction({
  args: {
    tradeId: v.id("trades"),
  },
  handler: async (ctx, { tradeId }) => {
    // 1. Gerekli veriyi business'tan al
    const trade = await ctx.runQuery(
      internal.apps.trading.tradingBusiness.getTradeById,
      { tradeId }
    );
    if (!trade) throw errors.notFound("Trade");

    // 2. Dış API çağrısı
    const apiKey = process.env.EXCHANGE_API_KEY;
    if (!apiKey) throw errors.internal("EXCHANGE_API_KEY tanımlı değil");

    let result: { orderId: string; executedPrice: number };
    try {
      const response = await fetch(`${process.env.EXCHANGE_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw errors.internal(`Exchange reddetti [${response.status}]: ${errorText}`);
      }

      result = await response.json();
    } catch (e) {
      if (e instanceof ConvexError) throw e;  // kendi hatamızsa yeniden fırlat
      throw errors.internal(`Exchange API iletişim hatası: ${String(e)}`);
    }

    // 3. Sonucu business'a yaz
    await ctx.runMutation(
      internal.apps.trading.tradingBusiness.confirmExchangeOrder,
      {
        tradeId,
        exchangeOrderId: result.orderId,
        executedPrice: result.executedPrice,
      }
    );
  },
});
```

---

## Adım 3 — Business Layer'da Tetikle

```typescript
// convex/apps/trading/trading.business.ts
export const createTrade = internalMutation({
  handler: async (ctx, args) => {
    const tradeId = await ctx.db.insert("trades", { ...args, status: "pending" });

    // Integration'ı schedule et
    await ctx.scheduler.runAfter(
      0,
      internal.apps.trading.tradingIntegration.submitToExchange,
      { tradeId }
    );

    return tradeId;
  },
});
```

---

## Action Retrier ile Güvenilirlik

Ağ hatalarında otomatik retry için:

```typescript
// convex/lib/retrier.ts
import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

export const retrier = new ActionRetrier(components.actionRetrier);
```

```typescript
// business.ts'te scheduler yerine retrier
import { retrier } from "../../lib/retrier";

export const createTrade = internalMutation({
  handler: async (ctx, args) => {
    const tradeId = await ctx.db.insert("trades", { ...args, status: "pending" });

    // Retry: maksimum 3 deneme, exponential backoff
    await retrier.run(
      ctx,
      internal.apps.trading.tradingIntegration.submitToExchange,
      { tradeId },
      { maxFailures: 3 }
    );

    return tradeId;
  },
});
```

---

## Shared Integration (Birden Fazla Domain)

Email gibi birden fazla domain'in kullandığı integrasyonlar:

```
convex/lib/integrations/
├── email.ts      → Resend/SendGrid
├── sms.ts        → Twilio
└── storage.ts    → S3 / Convex storage
```

```typescript
// convex/lib/integrations/email.ts
import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { errors } from "../errors";

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { to, subject, body }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: "noreply@app.com", to, subject, html: body }),
    });

    if (!response.ok) throw errors.internal("Email gönderilemedi");
  },
});
```

Her domain bu shared action'ı `ctx.runAction` ile çağırır:

```typescript
// notifications.business.ts
await ctx.scheduler.runAfter(0, internal.lib.integrations.email.sendEmail, {
  to: user.email,
  subject: "Trade onaylandı",
  body: `<p>Trade #${tradeId} onaylandı.</p>`,
});
```

---

## Webhook Alma

Gelen event'leri işlemek için:

```typescript
// convex/http.ts
app.post("/webhooks/exchange", async (c) => {
  // 1. Signature doğrula
  const signature = c.req.header("x-webhook-signature");
  const body = await c.req.text();
  if (!verifyHmac(body, signature, process.env.EXCHANGE_WEBHOOK_SECRET!)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // 2. Event'i parse et
  const event = JSON.parse(body);

  // 3. Business'a ilet — idempotency key ile
  await c.env.runMutation(
    internal.apps.trading.tradingBusiness.processExchangeWebhook,
    { event, idempotencyKey: event.id }
  );

  return c.json({ ok: true });
});
```

---

## Checklist

- [ ] Environment variable `.env.example`'a eklendi
- [ ] Convex dashboard'a environment variable eklendi
- [ ] `{domain}.integration.ts` oluşturuldu veya genişletildi
- [ ] Sadece `internalAction` kullanıldı
- [ ] `ctx.db` kullanılmadı (sadece `ctx.runQuery/runMutation`)
- [ ] Tüm fetch hataları yakalandı ve `errors.*` ile yeniden fırlatıldı
- [ ] Business layer'da tetikleme eklendi
- [ ] Action retrier gerekiyorsa eklendi
- [ ] `pnpm test:arch` geçiyor
