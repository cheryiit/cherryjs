# Webhook Altyapısı

Gelen webhook'ları güvenli, idempotent ve izlenebilir şekilde işlemek için tam altyapı.

---

## Webhook Akışı

```
Dış Servis
    ↓ HTTP POST
[http.ts — Hono Router]
    ↓ Signature verification (Hono middleware)
    ↓ Idempotency check
[core/webhook] → webhookEvents tablosuna yaz
    ↓
[Domain business] → olayı işle
    ↓
Response: 200 OK (her zaman — retry storm'unu önler)
```

---

## Schema

```typescript
// convex/core/webhook/webhook.schema.ts
export const webhookEventFields = {
  source: v.string(),                       // "clerk", "stripe", "exchange"
  event: v.string(),                        // "user.created", "payment.succeeded"
  payload: v.any(),                         // raw event body
  headers: v.optional(v.any()),             // relevant request headers
  idempotencyKey: v.string(),               // unique event ID from provider
  status: literals("received", "processing", "processed", "failed"),
  processedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  retryCount: v.number(),
  receivedAt: v.number(),
};

export const webhookEventsTables = {
  webhookEvents: defineTable(webhookEventFields)
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_source_event", ["source", "event"])
    .index("by_status", ["status"])
    .index("by_received_at", ["receivedAt"]),
};
```

---

## Hono HTTP Layer (`http.ts`)

### Signature Verification Middleware

```typescript
// convex/http.ts
import { Hono } from "hono";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { createMiddleware } from "hono/factory";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

const app = new Hono<{ Bindings: ActionCtx }>() as HonoWithConvex<ActionCtx>;

// ── Source-spesifik webhook handler'ları ─────────────────────────────────────

// Clerk Webhook
app.post("/webhooks/clerk", async (c) => {
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing Svix headers" }, 400);
  }

  const body = await c.req.text();

  // Svix imza doğrulama
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;
  const isValid = await verifyClerkSignature(
    body, svixId, svixTimestamp, svixSignature, webhookSecret
  );
  if (!isValid) return c.json({ error: "Invalid signature" }, 401);

  const event = JSON.parse(body);

  await c.env.runMutation(internal.core.webhook.webhookBusiness.receiveWebhook, {
    source: "clerk",
    event: event.type,
    payload: event.data,
    idempotencyKey: svixId,       // Svix her event için benzersiz ID verir
  });

  return c.json({ ok: true });
});

// Stripe Webhook
app.post("/webhooks/stripe", async (c) => {
  const stripeSignature = c.req.header("stripe-signature");
  if (!stripeSignature) return c.json({ error: "Missing signature" }, 400);

  const body = await c.req.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  // Stripe imza doğrulama (stripe-js SDK ile)
  let event: any;
  try {
    event = verifyStripeSignature(body, stripeSignature, webhookSecret);
  } catch (e) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  await c.env.runMutation(internal.core.webhook.webhookBusiness.receiveWebhook, {
    source: "stripe",
    event: event.type,
    payload: event.data.object,
    idempotencyKey: event.id,      // Stripe event ID benzersiz
  });

  return c.json({ ok: true });
});

export default new HttpRouterWithHono(app);
```

---

## Webhook Business Layer

```typescript
// convex/core/webhook/webhook.business.ts
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";

export const receiveWebhook = internalMutation({
  args: {
    source: v.string(),
    event: v.string(),
    payload: v.any(),
    idempotencyKey: v.string(),
    headers: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Idempotency: aynı event daha önce işlendi mi?
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .first();

    if (existing && existing.status === "processed") {
      return { eventId: existing._id, isDuplicate: true };
    }

    // Event'i kaydet
    const eventId = existing?._id ?? await ctx.db.insert("webhookEvents", {
      ...args,
      status: "received",
      retryCount: 0,
      receivedAt: Date.now(),
    });

    // Processing'e al
    await ctx.db.patch(eventId, { status: "processing" });

    // Source + event tipine göre route et
    try {
      await routeWebhookEvent(ctx, args.source, args.event, args.payload, eventId);

      await ctx.db.patch(eventId, {
        status: "processed",
        processedAt: Date.now(),
      });
    } catch (e) {
      const existing2 = await ctx.db.get(eventId);
      await ctx.db.patch(eventId, {
        status: "failed",
        error: String(e),
        retryCount: (existing2?.retryCount ?? 0) + 1,
      });
      throw e;  // HTTP katmanına hatayı ilet (429 varsa retry yapılacak)
    }

    return { eventId, isDuplicate: false };
  },
});

// Event routing tablosu
async function routeWebhookEvent(
  ctx: any,
  source: string,
  event: string,
  payload: any,
  _eventId: any
) {
  // Clerk events
  if (source === "clerk") {
    if (event === "user.created" || event === "user.updated") {
      await ctx.runMutation(internal.apps.users.usersBusiness.syncFromClerk, {
        clerkId: payload.id,
        name: `${payload.first_name ?? ""} ${payload.last_name ?? ""}`.trim(),
        email: payload.email_addresses?.[0]?.email_address,
        imageUrl: payload.image_url,
        operation: event === "user.created" ? "create" : "update",
      });
    } else if (event === "user.deleted") {
      await ctx.runMutation(internal.apps.users.usersBusiness.deactivateByClerkId, {
        clerkId: payload.id,
      });
    }
    return;
  }

  // Stripe events
  if (source === "stripe") {
    if (event === "payment_intent.succeeded") {
      await ctx.runMutation(internal.apps.payments.paymentsBusiness.confirmPayment, {
        stripePaymentIntentId: payload.id,
        amount: payload.amount,
      });
    }
    return;
  }

  // Bilinmeyen source — log'la ama hata fırlatma
  console.warn(`Unknown webhook source: ${source}:${event}`);
}
```

---

## Webhook Retry Yönetimi

Failed webhook'ları retry etmek için batch:

```typescript
// convex/core/webhook/webhook.business.ts
export const retryFailedWebhooks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const failedEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.lt(q.field("retryCount"), 3))  // max 3 retry
      .take(10);

    for (const event of failedEvents) {
      try {
        await routeWebhookEvent(ctx, event.source, event.event, event.payload, event._id);
        await ctx.db.patch(event._id, { status: "processed", processedAt: Date.now() });
      } catch (e) {
        await ctx.db.patch(event._id, {
          retryCount: event.retryCount + 1,
          error: String(e),
        });
      }
    }
  },
});
```

Cron ile periyodik retry:
```typescript
// core/schedule/core.schedule.ts
coreCrons.interval(
  "core-retry-failed-webhooks",
  { minutes: 10 },
  internal.core.webhook.webhookBusiness.retryFailedWebhooks,
  {}
);
```

---

## Signature Verification Helpers

```typescript
// convex/core/webhook/webhook.utils.ts (Node.js action içinde kullanılır)

import * as crypto from "crypto";

// Clerk (Svix)
export async function verifyClerkSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
  const hmac = crypto.createHmac("sha256", secretBytes);
  hmac.update(toSign);
  const computed = hmac.digest("base64");
  const signatures = svixSignature.split(" ").map((s) => s.replace("v1,", ""));
  return signatures.some((sig) => sig === computed);
}

// Generic HMAC
export function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string,
  algorithm = "sha256"
): boolean {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(body);
  const computed = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}
```

---

## Yeni Webhook Kaynağı Ekleme

1. `http.ts`'te yeni endpoint: `app.post("/webhooks/{source}", ...)`
2. Signature verification için provider dokümanına bak
3. `routeWebhookEvent` fonksiyonuna `source === "{source}"` case'ini ekle
4. `cronConfigs`'a retry cron'ını ekle

Checklist:
- [ ] Signature doğrulanıyor (401 döner, process edilmiyor)
- [ ] `idempotencyKey` provider'ın event ID'si
- [ ] Business mutation internal — channel bypass yok
- [ ] `webhookEvents` tablosuna her zaman yazılıyor
