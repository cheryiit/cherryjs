# Hono HTTP Middleware

`convex/http.ts` dosyasındaki Hono router'ına uygulanan middleware'ler.
Gelen HTTP isteklerini (webhook, özel endpoint) işler.

---

## Middleware Stack

```
HTTP İsteği
    ↓
[1. Request Logger]       → her isteği logla
    ↓
[2. CORS]                 → tarayıcı istekleri için
    ↓
[3. Security Headers]     → güvenlik başlıkları
    ↓
[4. Error Handler]        → unhandled error'ları yakala
    ↓
[Route Handler]           → webhook doğrulama + işleme
    ↓
Response
```

---

## Tam `http.ts` Yapısı

```typescript
// convex/http.ts
import { Hono } from "hono";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const app = new Hono<{ Bindings: ActionCtx }>() as HonoWithConvex<ActionCtx>;

// ── Global Middleware ─────────────────────────────────────────────────────────

// 1. Request Logger
app.use("*", logger());

// 2. CORS — sadece gerekli origin'lere
app.use("/api/*", cors({
  origin: process.env.APP_URL ?? "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// 3. Security Headers
app.use("*", secureHeaders({
  contentSecurityPolicy: false,  // SPA değil, header yeterli
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
}));

// 4. Error Handler
app.onError((err, c) => {
  console.error("HTTP Error:", err);
  return c.json(
    { error: err.message ?? "Internal server error" },
    { status: 500 }
  );
});

// ── Health Check ──────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ ok: true, timestamp: Date.now() }));

// ── Webhook Routes ────────────────────────────────────────────────────────────

app.post("/webhooks/clerk", handleClerkWebhook);
app.post("/webhooks/stripe", handleStripeWebhook);
app.post("/webhooks/exchange", handleExchangeWebhook);

// ── API Routes (Convex olmayan — gerçek HTTP API gerekirse) ───────────────────
// Genellikle gerekmez — Convex HTTP Actions zaten API'dir

export default new HttpRouterWithHono(app);
```

---

## Webhook Signature Middleware (Reusable)

```typescript
// convex/core/webhook/webhook.middleware.ts

import { createMiddleware } from "hono/factory";
import { verifyClerkSignature, verifyHmacSignature } from "./webhook.utils";

// Clerk webhook doğrulama middleware'i
export const clerkWebhookMiddleware = createMiddleware(async (c, next) => {
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing Svix headers" }, 400);
  }

  const body = await c.req.text();
  const isValid = await verifyClerkSignature(
    body, svixId, svixTimestamp, svixSignature,
    process.env.CLERK_WEBHOOK_SECRET!
  );

  if (!isValid) return c.json({ error: "Invalid signature" }, 401);

  // Parsed body'yi context'e koy
  c.set("rawBody", body);
  c.set("parsedBody", JSON.parse(body));
  c.set("svixId", svixId);

  await next();
});

// Generic HMAC middleware factory
export function hmacMiddleware(headerName: string, secretEnvKey: string) {
  return createMiddleware(async (c, next) => {
    const signature = c.req.header(headerName);
    if (!signature) return c.json({ error: "Missing signature header" }, 400);

    const body = await c.req.text();
    const secret = process.env[secretEnvKey];
    if (!secret) return c.json({ error: "Webhook secret not configured" }, 500);

    const isValid = verifyHmacSignature(body, signature, secret);
    if (!isValid) return c.json({ error: "Invalid signature" }, 401);

    c.set("rawBody", body);
    c.set("parsedBody", JSON.parse(body));
    await next();
  });
}
```

```typescript
// http.ts'te kullanım
app.post("/webhooks/clerk", clerkWebhookMiddleware, async (c) => {
  const event = c.get("parsedBody");
  const svixId = c.get("svixId");

  await c.env.runMutation(internal.core.webhook.webhookBusiness.receiveWebhook, {
    source: "clerk",
    event: event.type,
    payload: event.data,
    idempotencyKey: svixId,
  });

  return c.json({ ok: true });
});

app.post("/webhooks/github", hmacMiddleware("x-hub-signature-256", "GITHUB_WEBHOOK_SECRET"), async (c) => {
  // ...
});
```

---

## Rate Limiting (Hono + Convex Rate Limiter)

```typescript
// convex/core/webhook/webhook.middleware.ts
import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  webhookPerIp: { kind: "fixed window", rate: 100, period: 60 * 1000 },  // 100/dk
});

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? "unknown";

  const { ok, retryAfter } = await c.env.runMutation(
    internal.core.webhook.webhookBusiness.checkRateLimit,
    { ip }
  );

  if (!ok) {
    c.header("Retry-After", String(Math.ceil((retryAfter ?? 60000) / 1000)));
    return c.json({ error: "Too many requests" }, 429);
  }

  await next();
});
```

---

## Domain Sub-Router Pattern

Her domain için ayrı Hono sub-router:

```typescript
// convex/apps/trading/trading.http.ts
import { Hono } from "hono";
import type { ActionCtx } from "../../_generated/server";

export const tradingRouter = new Hono<{ Bindings: ActionCtx }>();

tradingRouter.post("/signal", hmacMiddleware("x-signal-key", "SIGNAL_SECRET"), async (c) => {
  const signal = c.get("parsedBody");
  await c.env.runMutation(
    internal.apps.trading.tradingBusiness.processSignal,
    { signal }
  );
  return c.json({ ok: true });
});

// http.ts'te mount et
app.route("/trading", tradingRouter);
// → POST /trading/signal
```

---

## Hono'da Convex DB Erişimi

`http.ts` içindeki handler'lar `internalAction` gibi çalışır:
- `ctx.db` **YOKTUR**
- `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` vardır
- Tüm DB işlemleri business katmanına delege edilir

```typescript
// ✅ Doğru
app.get("/api/trades", async (c) => {
  const userId = c.req.header("x-user-id");
  const trades = await c.env.runQuery(
    internal.apps.trading.tradingBusiness.listByUser, { userId }
  );
  return c.json(trades);
});

// ❌ Yanlış
app.get("/api/trades", async (c) => {
  const trades = await c.env.db.query("trades")...  // db yok!
});
```
