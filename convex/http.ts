import { Hono } from "hono";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import {
  extractIpFromRequest,
  parseLanguage,
} from "./lib/requestContext";
import { authComponent, createAuth } from "./auth";
import { polar } from "./lib/polar";

type HonoVariables = {
  requestCtx: {
    ip: string | null;
    language: string | null;
    userAgent: string | undefined;
  };
};

const app = new Hono<{ Variables: HonoVariables }>();

// ── Request Context Middleware ─────────────────────────────────────────────────

app.use("*", async (c, next) => {
  const ip = extractIpFromRequest(c.req.raw);
  const language = parseLanguage(c.req.header("accept-language") ?? null);
  const userAgent = c.req.header("user-agent") ?? undefined;
  c.set("requestCtx", { ip, language, userAgent });
  await next();
});

// ── Health Check ──────────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({ ok: true, timestamp: Date.now() });
});

// ── Convex HTTP Router ────────────────────────────────────────────────────────

const http = httpRouter();

// Better-Auth routes (component v0.10+ takes createAuth as second arg)
authComponent.registerRoutes(http, createAuth, { cors: true });

// Polar payment webhooks (component handles signature verification, dedup,
// subscription/customer/product sync, and onSubscription* callbacks).
polar.registerRoutes(http);

// Health
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_, request) => {
    return app.fetch(request);
  }),
});

export default http;
