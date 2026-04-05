# Hono ile Convex HTTP Routing

Kaynak: https://stack.convex.dev/hono-with-convex

## Neden Hono?

Convex'in varsayilan HTTP router'i temel path/method eslestirmesi yapar. Hono ile:
- Dynamic route params (`:userId`)
- Middleware zinciri
- Zod input validation
- Otomatik JSON response
- Pretty print ve error handling
- Dashboard'da gozukur (HttpRouterWithHono ile)

## Kurulum

```bash
pnpm add hono convex-helpers
```

## Temel Kurulum

```typescript
// convex/http.ts
import { Hono } from "hono";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

// HonoWithConvex — ActionCtx'i environment binding olarak alir
const app = new Hono<HonoWithConvex<ActionCtx>>();

export default new HttpRouterWithHono(app);
```

## Route Tanimlama

```typescript
// GET /users/:id
app.get("/users/:id", async (c) => {
  const userId = c.req.param("id");
  const user = await c.env.runQuery(internal.users.getById, { userId });
  
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json(user);
});

// POST /posts
app.post("/posts", async (c) => {
  const body = await c.req.json();
  const postId = await c.env.runMutation(internal.posts.create, body);
  return c.json({ id: postId }, 201);
});

// DELETE /posts/:id
app.delete("/posts/:id", async (c) => {
  const postId = c.req.param("id");
  await c.env.runMutation(internal.posts.delete, { postId });
  return c.json({ success: true });
});
```

## Middleware

```typescript
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// CORS
app.use("*", cors({
  origin: process.env.CLIENT_ORIGIN ?? "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Logging
app.use("*", logger());

// Auth middleware
app.use("/api/*", async (c, next) => {
  const identity = await c.env.auth.getUserIdentity();
  if (!identity) return c.json({ error: "Unauthorized" }, 401);
  c.set("identity", identity);
  await next();
});
```

## Zod ile Input Validation

```typescript
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

app.post(
  "/posts",
  zValidator("json", createPostSchema),
  async (c) => {
    const data = c.req.valid("json");
    // data.title, data.body — type-safe ve dogrulanmis
    
    const postId = await c.env.runMutation(internal.posts.create, data);
    return c.json({ id: postId }, 201);
  }
);
```

## Error Handling

```typescript
app.onError((err, c) => {
  console.error("HTTP Error:", err);
  
  if (err instanceof ConvexError) {
    return c.json({ error: err.data }, 400);
  }
  
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});
```

## Webhook Pattern

```typescript
import { Webhook } from "svix";

app.post("/webhooks/clerk", async (c) => {
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  
  const payload = await c.req.text();
  const headers = {
    "svix-id": c.req.header("svix-id") ?? "",
    "svix-signature": c.req.header("svix-signature") ?? "",
    "svix-timestamp": c.req.header("svix-timestamp") ?? "",
  };
  
  let event;
  try {
    event = wh.verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }
  
  await c.env.runMutation(internal.webhooks.handleClerk, { event });
  return c.json({ success: true });
});
```

## Tam http.ts Ornegi

```typescript
// convex/http.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const app = new Hono<HonoWithConvex<ActionCtx>>();

// Global CORS
app.use("*", cors({ origin: process.env.CLIENT_ORIGIN ?? "*" }));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Webhooks
app.post("/webhooks/clerk", /* ... */);
app.post("/webhooks/stripe", /* ... */);

// API routes (auth korumalı)
app.use("/api/*", async (c, next) => {
  const identity = await c.env.auth.getUserIdentity();
  if (!identity) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

app.get("/api/me", async (c) => {
  const identity = await c.env.auth.getUserIdentity();
  const user = await c.env.runQuery(internal.users.getByToken, {
    tokenIdentifier: identity!.tokenIdentifier,
  });
  return c.json(user);
});

export default new HttpRouterWithHono(app);
```
