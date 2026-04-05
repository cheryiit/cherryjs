# Convex HTTP Actions

Kaynak: https://docs.convex.dev/functions/http-actions

## Nedir?

HTTP Actions, Convex içinde tam bir HTTP API oluşturmanı sağlar. Web standard `Request` alır, `Response` döner.

**Deploy URL:** `https://<deployment>.convex.site`

## Temel Yapı

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/api/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    
    // Veritabanı işlemi
    await ctx.runMutation(internal.webhooks.process, { data: body });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

## Path Prefix ile Dynamic Routes

```typescript
// /users/123/profile gibi dynamic path'ler
http.route({
  pathPrefix: "/users/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.pathname.replace("/users/", "").split("/")[0];
    
    const user = await ctx.runQuery(internal.users.get, { userId });
    
    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});
```

## CORS Desteği

```typescript
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Preflight handler
http.route({
  path: "/api/data",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { headers: corsHeaders });
  }),
});

http.route({
  path: "/api/data",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ...
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});
```

## Authentication

```typescript
http.route({
  path: "/api/protected",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Authorization header'dan auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    // ...
  }),
});
```

Client tarafında Bearer token gönderme:
```typescript
const response = await fetch(`${CONVEX_SITE_URL}/api/protected`, {
  headers: {
    Authorization: `Bearer ${await getToken()}`,
  },
});
```

## Hono ile Gelişmiş Routing

```typescript
// convex/http.ts
import { Hono } from "hono";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";

const app = new Hono<HonoWithConvex>();

// Middleware
app.use("*", cors({ origin: process.env.CLIENT_ORIGIN }));

// Route
app.get("/users/:id", async (c) => {
  const userId = c.req.param("id");
  const user = await c.env.runQuery(internal.users.get, { userId });
  return c.json(user);
});

app.post("/posts", zValidator("json", postSchema), async (c) => {
  const data = c.req.valid("json");
  const postId = await c.env.runMutation(internal.posts.create, data);
  return c.json({ id: postId }, 201);
});

export default new HttpRouterWithHono(app);
```

## Limitler

| Özellik | Limit |
|---------|-------|
| Request body | 20MB |
| Response body | 20MB |
| Node.js API | Yok (Convex runtime) |
| Auto-retry | Yok (side effects) |

## Webhook Pattern

```typescript
// Stripe webhook örneği
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();
    
    // Signature doğrulama
    if (!verifyStripeSignature(body, signature)) {
      return new Response("Invalid signature", { status: 400 });
    }
    
    const event = JSON.parse(body);
    await ctx.runMutation(internal.stripe.handleWebhook, { event });
    
    return new Response("OK", { status: 200 });
  }),
});
```
