# Request Context ve Audit — Ortak Altyapı

`lib/request-context.ts` + `lib/audit.ts` birlikte çalışır.
Her authenticated işlem otomatik olarak kullanıcı metadatasını taşır ve audit trail bırakır.

---

## Convex'te IP Adresi — Önemli Kısıtlama

| Bağlam | IP Erişimi | Yöntem |
|--------|-----------|--------|
| `mutation` / `query` | **YOK** | Convex internal transport — IP geçmez |
| `action` | **YOK** | Convex runtime — IP erişimi yok |
| Hono HTTP Action | **VAR** | `c.req.header("x-forwarded-for")` |
| `_requestMeta` arg (client inject) | **Sınırlı** | Client tarafından gönderilir — güvenilmez |

> **Sonuç:** Güvenilir IP logu yalnızca Hono HTTP Actions'ta mümkündür.
> Regular mutation'larda IP yerine `userId` + `userAgent` + `language` loglanır.
> Webhook ve auth endpoint'leri Hono üzerinden geldiği için IP logu mevcut.

---

## lib/request-context.ts

```typescript
// convex/lib/request-context.ts

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

// ── RequestMeta: Client'tan gelen metadata ─────────────────────────────────────
// Mutation/action'a _requestMeta arg olarak inject edilir
// Güvenilir değil — analytics için kullanılır, güvenlik kararı için değil

export const requestMetaValidator = v.optional(
  v.object({
    userAgent: v.optional(v.string()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    // NOT: ip — production'da Convex mutations'tan alınamaz
    // Hono endpoint'lerinden gelen IP için core/webhook veya audit'e bakın
  })
);

export type RequestMeta = {
  userAgent?: string;
  language?: string;
  timezone?: string;
};

// ── RequestContext: ctx'e inject edilen tam context ───────────────────────────

export type RequestContext = {
  userId: Id<"users">;
  userEmail?: string;
  userRole: "admin" | "user";
  requestMeta: RequestMeta | null;
};

// ── HTTP Request Context: Hono'dan gelen (IP mevcut) ─────────────────────────

export type HttpRequestContext = RequestContext & {
  ip: string | null;
  origin: string | null;
};

// ── Helper: Hono'dan IP çıkarma ───────────────────────────────────────────────

export function extractIpFromRequest(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

// ── Helper: Accept-Language parse ────────────────────────────────────────────

export function parseLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return "en";
  return acceptLanguage.split(",")[0]?.split(";")[0]?.trim() ?? "en";
}
```

---

## lib/functions.ts — RequestMeta Injection

`_requestMeta` arg'ı tüm authenticated wrapper'lara eklenir.
Handler'da göründüğü gibi `ctx.requestMeta`'ya taşınır, `args`'tan gizlenir.

```typescript
// convex/lib/functions.ts — güncel authenticated wrapper

import { requestMetaValidator, type RequestMeta } from "./request-context";

export const authenticatedMutation = customMutation(mutation, {
  args: {
    _requestMeta: requestMetaValidator,
  },
  input: async (ctx, { _requestMeta }) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");

    const requestMeta: RequestMeta | null = _requestMeta ?? null;

    return {
      ctx: {
        ...ctx,
        user,
        requestMeta,
        // Audit helper — ctx.audit.log(...) ile çağrılır
        audit: buildAuditHelper(ctx, user._id, requestMeta),
      },
      args: {},
    };
  },
});

export const authenticatedQuery = customQuery(query, {
  args: {
    _requestMeta: requestMetaValidator,
  },
  input: async (ctx, { _requestMeta }) => {
    const user = await resolveCurrentUser(ctx);
    if (!user) throw errors.unauthenticated();
    if (!user.isActive) throw errors.forbidden("Account is deactivated");

    return {
      ctx: {
        ...ctx,
        user,
        requestMeta: _requestMeta ?? null,
      },
      args: {},
    };
  },
});
```

---

## lib/audit.ts

```typescript
// convex/lib/audit.ts

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { RequestMeta } from "./request-context";

// ── Audit Seviyesi ────────────────────────────────────────────────────────────

export type AuditSeverity = "info" | "warn" | "critical";

// ── Audit Log Payload ─────────────────────────────────────────────────────────

export type AuditPayload = {
  action: string;           // "trade.create", "user.delete", "admin.ban"
  resourceType?: string;    // "trade", "user", "payment"
  resourceId?: string;      // Id<"trades"> vb.
  details?: Record<string, unknown>; // Ek bağlam
  severity?: AuditSeverity;
};

// ── AuditHelper: ctx.audit.log() arayüzü ─────────────────────────────────────

export type AuditHelper = {
  log: (payload: AuditPayload) => Promise<void>;
  warn: (payload: Omit<AuditPayload, "severity">) => Promise<void>;
  critical: (payload: Omit<AuditPayload, "severity">) => Promise<void>;
};

// ── buildAuditHelper ──────────────────────────────────────────────────────────

export function buildAuditHelper(
  ctx: MutationCtx,
  userId: Id<"users">,
  requestMeta: RequestMeta | null
): AuditHelper {
  const write = async (payload: AuditPayload) => {
    await ctx.db.insert("auditLogs", {
      userId,
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      details: payload.details,
      severity: payload.severity ?? "info",
      userAgent: requestMeta?.userAgent,
      language: requestMeta?.language,
      timezone: requestMeta?.timezone,
      timestamp: Date.now(),
    });
  };

  return {
    log: write,
    warn: (payload) => write({ ...payload, severity: "warn" }),
    critical: (payload) => write({ ...payload, severity: "critical" }),
  };
}
```

---

## Audit Kullanım Örnekleri

```typescript
// apps/trading/trading.business.ts

export const createTrade = internalMutation({
  args: { userId: v.id("users"), symbol: v.string(), quantity: v.number() },
  handler: async (ctx, { userId, symbol, quantity }) => {
    const tradeId = await ctx.db.insert("trades", { userId, symbol, quantity });

    // Explicit audit log — ctx.audit channel'dan inject edildi
    await ctx.audit.log({
      action: "trade.create",
      resourceType: "trade",
      resourceId: tradeId,
      details: { symbol, quantity },
    });

    return tradeId;
  },
});

// Kritik işlemler
export const deleteAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.audit.critical({
      action: "user.delete",
      resourceType: "user",
      resourceId: userId,
      details: { reason: "user-requested" },
    });

    await ctx.db.delete(userId);
  },
});
```

---

## Trigger-Based Otomatik Audit vs Explicit Audit

| Yaklaşım | Ne Zaman | İçerik |
|----------|---------|--------|
| **Trigger** (`triggers.ts`) | Her DB write'ta otomatik | Table adı, operation type, doc ID |
| **Explicit** (`ctx.audit.log()`) | Business event'inde manuel | Action adı, business context, severity |

İkisi birbirini tamamlar:

```
trade oluşturuldu
  → trigger: { table: "trades", op: "insert", id: "j123..." }    ← otomatik
  → explicit: { action: "trade.create", symbol: "BTC", qty: 0.5 } ← manuel
```

Trigger, ham DB aktivitesini yakalar.
Explicit audit, business event bağlamını yakalar.

---

## Hono HTTP Actions'ta RequestContext

```typescript
// convex/core/webhook/webhook.middleware.ts

import { extractIpFromRequest, parseLanguage } from "../../lib/request-context";

export function withHttpRequestContext() {
  return async (c: Context, next: () => Promise<void>) => {
    const ip = extractIpFromRequest(c.req.raw);
    const language = parseLanguage(c.req.header("accept-language") ?? null);
    const userAgent = c.req.header("user-agent") ?? null;

    // Hono context'e inject et — handler c.get("requestCtx") ile okur
    c.set("requestCtx", { ip, language, userAgent });
    await next();
  };
}

// http.ts'te kullanım:
// app.use("*", withHttpRequestContext());
```

HTTP action'larda audit log:

```typescript
// Hono handler'ında
app.post("/webhooks/stripe", async (c) => {
  const { ip, userAgent } = c.get("requestCtx");

  // Webhook audit
  await ctx.runMutation(internal.core.audit.auditBusiness.writeHttpAudit, {
    action: "webhook.stripe.received",
    ip: ip ?? "unknown",
    userAgent: userAgent ?? "unknown",
    severity: "info",
  });
});
```

---

## auditLogs Tablosu

```typescript
// core/core.schema.ts

auditLogs: defineTable({
  userId: v.optional(v.id("users")),   // Anonymous events için optional
  action: v.string(),                  // "trade.create", "user.login"
  resourceType: v.optional(v.string()),
  resourceId: v.optional(v.string()),
  details: v.optional(v.any()),
  severity: v.union(
    v.literal("info"),
    v.literal("warn"),
    v.literal("critical")
  ),
  // Request metadata
  userAgent: v.optional(v.string()),
  language: v.optional(v.string()),
  timezone: v.optional(v.string()),
  ip: v.optional(v.string()),          // Sadece HTTP actions doldurur
  // Timestamp
  timestamp: v.number(),
})
  .index("by_user", ["userId", "timestamp"])
  .index("by_action", ["action", "timestamp"])
  .index("by_severity", ["severity", "timestamp"])
  .index("by_resource", ["resourceType", "resourceId"]),
```

---

## Architectural Test — Audit Helper Kullanımı

```typescript
// tests/architectural/audit-enforcement.test.ts

describe("Audit Helper Enforcement", () => {
  // business dosyalarında direkt ctx.db.insert("auditLogs") kullanımı yasak
  const businessFiles = glob.sync("convex/apps/**/*.business.ts");

  businessFiles.forEach((file) => {
    it(`${file}: should not directly insert into auditLogs`, () => {
      const content = fs.readFileSync(file, "utf-8");
      const hasDirectInsert = content.includes('"auditLogs"') &&
        content.includes("ctx.db.insert");

      // Direkt insert → use ctx.audit.log() instead
      expect(hasDirectInsert).toBe(false);
    });
  });
});
```
