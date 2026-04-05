# Backend Yapısı — Convex

Tam dizin ağacı ve her dosyanın rolü.

---

## Dizin Ağacı

```
convex/
│
├── schema.ts                    # ~30 satır aggregator — sadece import + defineSchema
├── http.ts                      # HTTP router (Hono) — webhook'lar, dış endpoint'ler
├── triggers.ts                  # DB trigger registry — atomic side effect'ler
│
├── lib/                         # Framework altyapısı — nadiren değişir
│   ├── functions.ts             # Approved custom function wrapper'ları
│   ├── errors.ts                # ErrorCode enum + ConvexError factory
│   ├── permissions.ts           # RBAC — Role, Permission registry
│   ├── rls.ts                   # Row-Level Security kuralları
│   ├── workflow.ts              # @convex-dev/workflow manager instance
│   └── retrier.ts               # @convex-dev/action-retrier instance
│
├── model/                       # Saf DB operasyon helper'ları
│   ├── user.model.ts
│   ├── trade.model.ts
│   └── {domain}.model.ts
│
├── core/                        # Framework altyapı domain'i — bkz. 09-core/
│   ├── core.schema.ts           # Tüm core tablo tanımları
│   ├── schedule/
│   │   ├── schedule.model.ts
│   │   ├── schedule.business.ts # scheduleTask, cancelTask, syncStatus
│   │   └── schedule.channel.ts  # Admin: list, toggle cron, cancel task
│   ├── parameter/
│   │   ├── parameter.model.ts
│   │   ├── parameter.business.ts
│   │   └── parameter.channel.ts
│   ├── webhook/
│   │   ├── webhook.model.ts
│   │   ├── webhook.business.ts  # receiveWebhook (idempotency + routing)
│   │   └── webhook.middleware.ts # Hono middleware'leri
│   └── audit/
│       ├── audit.model.ts
│       ├── audit.business.ts
│       └── audit.batch.ts       # Eski log temizleme
│
└── apps/                        # Business domain'leri — bkz. 03-layers/
    ├── users/
    │   ├── users.schema.ts      # Domain tablo tanımları
    │   ├── users.channel.ts     # Public API (query/mutation wrappers)
    │   ├── users.business.ts    # Business logic (internalMutation/Query)
    │   ├── users.schedule.ts    # Cron + scheduled functions
    │   └── users.batch.ts       # Bulk operasyonlar (varsa)
    │
    ├── trading/
    │   ├── trading.schema.ts
    │   ├── trading.channel.ts
    │   ├── trading.business.ts
    │   ├── trading.integration.ts   # 3rd party (internalAction)
    │   ├── trading.schedule.ts
    │   └── trading.batch.ts
    │
    └── notifications/
        ├── notifications.schema.ts
        ├── notifications.channel.ts
        ├── notifications.business.ts
        └── notifications.integration.ts  # Email/SMS API
```

---

## schema.ts

**Tek dosya — hiçbir zaman split edilmez.**

```typescript
// Neden tek dosya?
// 1. Tüm index tanımları tek yerde görülür — çakışma yakalanır
// 2. Cross-table relationship'ler kolayca izlenir
// 3. Schema review = tek PR diff

export const userFields = { ... };  // Field tanımları export edilir → validators'da reuse
export const tradeFields = { ... };

export default defineSchema({
  users: defineTable(userFields).index(...),
  trades: defineTable(tradeFields).index(...),
});
```

---

## lib/functions.ts

Framework'ün çekirdeği. Tüm public/internal fonksiyon wrapper'ları burada.

| Export | Kullanım |
|--------|----------|
| `publicQuery` | Auth gerektirmeyen query |
| `publicMutation` | Auth gerektirmeyen mutation (webhook vb.) |
| `authenticatedQuery` | Oturum açmış kullanıcı gerektirir |
| `authenticatedMutation` | Oturum açmış kullanıcı gerektirir |
| `adminQuery` | Admin rolü gerektirir |
| `adminMutation` | Admin rolü gerektirir |
| `internalAuthQuery` | Server-to-server query |
| `internalAuthMutation` | Server-to-server mutation |
| `internalAuthAction` | Server-to-server action |

Her wrapper `ctx.user` veya `ctx.identity` inject eder — elle çekmek gerekmez.

---

## model/{domain}.model.ts

Kurallar:
- Fonksiyon imzaları: `(ctx: QueryCtx | MutationCtx, ...args) → Promise<Doc | null>`
- Hata fırlatmaz — null döner
- İsimlendirme: `get{Entity}By{Field}`, `list{Entity}By{Field}`
- Auth kontrolü yoktur

```typescript
// model/trade.model.ts
export async function getTradeById(ctx: QueryCtx, id: Id<"trades">) {
  return ctx.db.get(id);  // null olabilir — business layer handle eder
}

export async function listTradesByUser(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("trades")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}
```

---

## apps/{domain}/{domain}.channel.ts

Kurallar:
- Sadece `lib/functions.ts`'teki wrapper'lar kullanılır
- Handler **20 satırı geçmez**
- Business logic (if-else, hesaplama) yoktur
- Her handler, ilgili business fonksiyonuna delege eder

```typescript
export const createTrade = authenticatedMutation({
  args: { symbol: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.apps.trading.tradingBusiness.createTrade, {
      userId: ctx.user._id,
      ...args,
    });
  },
});
```

---

## apps/{domain}/{domain}.business.ts

Kurallar:
- Sadece `internalMutation`, `internalQuery`, `internalAction`
- TÜM business logic burada
- Model fonksiyonlarını kullanır
- Unit test ile kapsamlı test edilir

```typescript
export const createTrade = internalMutation({
  args: { userId: v.id("users"), symbol: v.string(), quantity: v.number() },
  handler: async (ctx, { userId, symbol, quantity }) => {
    // Business rules burada
    const balance = await getBalance(ctx, userId);
    if (balance < quantity * price) throw errors.custom("INSUFFICIENT_FUNDS", "...");

    const tradeId = await ctx.db.insert("trades", { ... });

    // Side effect schedule
    await ctx.scheduler.runAfter(0, internal.apps.trading.tradingIntegration.submitOrder, {
      tradeId,
    });

    return tradeId;
  },
});
```

---

## apps/{domain}/{domain}.integration.ts

Kurallar:
- Sadece `internalAction`
- Dış API çağrıları buraya aittir
- DB'ye doğrudan yazmaz → `ctx.runMutation` ile business'ı çağırır
- Hata yakalanır ve ConvexError'a dönüştürülür

```typescript
export const submitOrder = internalAction({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const response = await fetch("https://exchange.api/orders", { ... });
    if (!response.ok) throw errors.internal("Exchange API rejected order");

    const { orderId } = await response.json();

    // DB'ye internalMutation ile yaz
    await ctx.runMutation(internal.apps.trading.tradingBusiness.confirmOrder, {
      tradeId,
      orderId,
    });
  },
});
```

---

## apps/{domain}/{domain}.schedule.ts

```typescript
// Cron + domain'e özgü scheduled fonksiyonlar
const tradingCrons = cronJobs();

tradingCrons.daily(
  "daily-portfolio-snapshot",
  { hourUTC: 0, minuteUTC: 0 },
  internal.apps.trading.tradingBusiness.snapshotPortfolios
);

export default tradingCrons;
```

**Not:** Her domain'in cron'ları kendi schedule dosyasındadır.
Ana `convex/crons.ts` dosyası yoktur — her domain kendi cronlarını yönetir.

---

## apps/{domain}/{domain}.batch.ts

Büyük veri işlemleri — pagination tabanlı çalışır.

```typescript
export const batchIndexTrades = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const paginator = new Paginator(ctx.db, {
      table: "trades",
      index: "by_status",
      startIndexKey: cursor ? JSON.parse(cursor) : ["pending"],
    });

    let processed = 0;
    for await (const trade of paginator.take(100)) {
      await ctx.db.patch(trade._id, { indexedAt: Date.now() });
      processed++;
    }

    if (!paginator.isDone) {
      // Kendini reschedule et
      await ctx.scheduler.runAfter(100, internal.apps.trading.tradingBatch.batchIndexTrades, {
        cursor: JSON.stringify(paginator.cursor),
      });
    }

    return { processed, hasMore: !paginator.isDone };
  },
});
```

---

## http.ts (Hono)

```typescript
// Webhook'lar ve özel HTTP endpoint'ler
app.post("/webhooks/clerk", handleClerkWebhook);
app.post("/webhooks/stripe", handleStripeWebhook);
app.get("/health", (c) => c.json({ ok: true }));
```

Domain başına bir Hono sub-router:

```typescript
// Routing prefix'i ile domain isolation
const tradingRouter = new Hono();
tradingRouter.post("/signal", handleSignal);

app.route("/trading", tradingRouter);
```
