import { Hono } from "hono";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  extractIpFromRequest,
  parseLanguage,
} from "./lib/request-context";
import { validateWebhookSignature } from "./lib/webhook-verify";
import { authComponent } from "./auth";

const app = new Hono();

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

// Better-Auth routes
authComponent.registerRoutes(http);

// Health
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_, request) => {
    return app.fetch(request);
  }),
});

// Polar payment webhook
http.route({
  path: "/payments/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      if (!process.env.POLAR_ACCESS_TOKEN) {
        return new Response(
          JSON.stringify({ message: "Payments not configured" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      const rawBody = await request.text();
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Validate signature
      if (process.env.POLAR_WEBHOOK_SECRET) {
        await validateWebhookSignature(
          rawBody,
          headers,
          process.env.POLAR_WEBHOOK_SECRET,
        );
      }

      const body = JSON.parse(rawBody);
      const webhookId =
        headers["webhook-id"] ??
        headers["webhook_id"] ??
        headers["x-webhook-id"];

      await ctx.runMutation(
        internal.apps.payments.paymentsBusiness.handleWebhookEvent,
        { body, webhookId },
      );

      return new Response(
        JSON.stringify({ message: "Webhook received" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isVerification =
        msg.includes("verification") || msg.includes("signature");
      return new Response(
        JSON.stringify({ message: isVerification ? "Verification failed" : "Webhook failed" }),
        {
          status: isVerification ? 403 : 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

export default http;
