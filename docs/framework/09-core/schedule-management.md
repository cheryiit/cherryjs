# Schedule Yönetimi

CherryJS'teki schedule sistemi iki soruyu yanıtlar:
1. **"Bu görevi daha önce planladım mı?"** → idempotency
2. **"Bu cron şu an çalışmalı mı?"** → runtime toggle

---

## İki Farklı Schedule Türü

| Tür | Ne | Pattern |
|-----|-----|---------|
| **Functional** | Belirli bir domain operasyonu için tek seferlik zamanlama | `scheduleTask()` helper |
| **Cron** | Periyodik tekrarlayan görev | `cronJobs()` + `cronConfigs` tablosu |

---

## Schema: `scheduledTasks` Tablosu

```typescript
// convex/core/schedule/schedule.schema.ts
export const scheduledTaskFields = {
  // Kimlik
  name: v.string(),                    // "order-timeout:123abc" — okunabilir, benzersiz tercih
  domain: v.string(),                  // "trading"
  type: v.string(),                    // "order-timeout"

  // Convex bağlantısı
  convexScheduleId: v.optional(v.id("_scheduled_functions")),

  // Durum
  status: literals("pending", "running", "completed", "failed", "cancelled"),

  // Payload
  payload: v.optional(v.any()),

  // Idempotency
  idempotencyKey: v.optional(v.string()),

  // Zamanlama
  scheduledFor: v.number(),            // ms timestamp
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),

  // Hata takibi
  lastError: v.optional(v.string()),
  retryCount: v.number(),
  maxRetries: v.number(),

  createdAt: v.number(),
  createdBy: v.optional(v.id("users")),
};

export const scheduledTasksTables = {
  scheduledTasks: defineTable(scheduledTaskFields)
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_domain_type", ["domain", "type"])
    .index("by_status", ["status"])
    .index("by_name", ["name"]),
};
```

---

## Schema: `cronConfigs` Tablosu

```typescript
export const cronConfigFields = {
  name: v.string(),                    // matches schedule.ts cron name
  domain: v.string(),
  description: v.optional(v.string()),
  isEnabled: v.boolean(),
  lastRunAt: v.optional(v.number()),
  lastRunStatus: v.optional(literals("success", "failed", "skipped")),
  consecutiveFailures: v.number(),
  maxConsecutiveFailures: v.number(),  // 5 başarısızlık sonrası auto-disable
};

export const cronConfigsTables = {
  cronConfigs: defineTable(cronConfigFields)
    .index("by_name", ["name"])
    .index("by_domain", ["domain"]),
};
```

---

## Functional Schedule — `scheduleTask` Helper

```typescript
// convex/core/schedule/schedule.business.ts
import { internalMutation, internalQuery } from "../../_generated/server";

export const scheduleTask = internalMutation({
  args: {
    name: v.string(),
    domain: v.string(),
    type: v.string(),
    functionRef: v.any(),     // internal.apps.xxx.yyy — func reference
    args: v.any(),
    delayMs: v.number(),
    idempotencyKey: v.optional(v.string()),
    maxRetries: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { idempotencyKey } = args;

    // Idempotency: aynı key ile bekleyen/çalışan task varsa döndür
    if (idempotencyKey) {
      const existing = await ctx.db
        .query("scheduledTasks")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", idempotencyKey)
        )
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "running")
          )
        )
        .first();
      if (existing) return { taskId: existing._id, isDuplicate: true };
    }

    // Convex'te planla
    const convexScheduleId = await ctx.scheduler.runAfter(
      args.delayMs,
      args.functionRef,
      args.args
    );

    const taskId = await ctx.db.insert("scheduledTasks", {
      name: args.name,
      domain: args.domain,
      type: args.type,
      convexScheduleId,
      status: "pending",
      payload: args.args,
      idempotencyKey,
      scheduledFor: Date.now() + args.delayMs,
      retryCount: 0,
      maxRetries: args.maxRetries ?? 3,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });

    return { taskId, isDuplicate: false };
  },
});

export const cancelTask = internalMutation({
  args: {
    taskId: v.optional(v.id("scheduledTasks")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, idempotencyKey }) => {
    // Task'ı bul
    let task = taskId ? await ctx.db.get(taskId) : null;
    if (!task && idempotencyKey) {
      task = await ctx.db
        .query("scheduledTasks")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .first();
    }
    if (!task || task.status !== "pending") return { cancelled: false };

    // Convex'te iptal et
    if (task.convexScheduleId) {
      await ctx.scheduler.cancel(task.convexScheduleId);
    }

    await ctx.db.patch(task._id, { status: "cancelled" });
    return { cancelled: true };
  },
});

export const markTaskStarted = internalMutation({
  args: { taskId: v.id("scheduledTasks") },
  handler: async (ctx, { taskId }) => {
    await ctx.db.patch(taskId, {
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const markTaskCompleted = internalMutation({
  args: {
    taskId: v.id("scheduledTasks"),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, success, error }) => {
    await ctx.db.patch(taskId, {
      status: success ? "completed" : "failed",
      completedAt: Date.now(),
      lastError: error,
    });
  },
});
```

---

## Domain'de Kullanım Örneği

```typescript
// trading.business.ts

// Order oluştururken timeout schedule'ı
export const createTrade = internalMutation({
  handler: async (ctx, { userId, symbol, quantity, price }) => {
    const tradeId = await ctx.db.insert("trades", {
      userId, symbol, quantity, price, status: "pending", createdAt: Date.now(),
    });

    // Idempotent timeout: 24 saatte expire olacak
    await ctx.runMutation(internal.core.schedule.scheduleBusiness.scheduleTask, {
      name: `order-timeout:${tradeId}`,
      domain: "trading",
      type: "order-timeout",
      functionRef: internal.apps.trading.tradingBusiness.expireOrder,
      args: { tradeId },
      delayMs: 24 * 60 * 60 * 1000,
      idempotencyKey: `order-timeout:${tradeId}`,  // Tekrar planlanmaz
    });

    return tradeId;
  },
});

// Order fill olduğunda timeout'u iptal et
export const fillOrder = internalMutation({
  handler: async (ctx, { tradeId, executedPrice }) => {
    await ctx.db.patch(tradeId, { status: "filled", price: executedPrice });

    // Timeout'u iptal et (artık gerekmiyor)
    await ctx.runMutation(internal.core.schedule.scheduleBusiness.cancelTask, {
      idempotencyKey: `order-timeout:${tradeId}`,
    });
  },
});

// Expire handler — task başlayınca kendi kaydını günceller
export const expireOrder = internalMutation({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const trade = await ctx.db.get(tradeId);
    if (!trade || trade.status !== "pending") return;  // Zaten fill/cancel olmuş

    await ctx.db.patch(tradeId, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });
  },
});
```

---

## Cron Runtime Toggle

Cron job'lar `schedule.ts` dosyasında tanımlanır ama `cronConfigs` tablosunu kontrol eder:

```typescript
// trading.schedule.ts

// Cron handler — en başta config'i kontrol eder
async function withCronGuard(
  ctx: MutationCtx,
  name: string,
  fn: () => Promise<any>
) {
  const config = await ctx.db
    .query("cronConfigs")
    .withIndex("by_name", (q) => q.eq("name", name))
    .first();

  // Disabled veya config yoksa (henüz seed edilmemiş) atla
  if (config && !config.isEnabled) {
    await ctx.db.patch(config._id, {
      lastRunAt: Date.now(),
      lastRunStatus: "skipped",
    });
    return { skipped: true };
  }

  try {
    const result = await fn();
    if (config) {
      await ctx.db.patch(config._id, {
        lastRunAt: Date.now(),
        lastRunStatus: "success",
        consecutiveFailures: 0,
      });
    }
    return result;
  } catch (e) {
    if (config) {
      const newFailCount = (config.consecutiveFailures ?? 0) + 1;
      const shouldDisable = newFailCount >= config.maxConsecutiveFailures;
      await ctx.db.patch(config._id, {
        lastRunAt: Date.now(),
        lastRunStatus: "failed",
        consecutiveFailures: newFailCount,
        isEnabled: shouldDisable ? false : config.isEnabled,
      });
    }
    throw e;
  }
}

// Cron handler tanımı
export const runDailySnapshot = internalMutation({
  handler: async (ctx) => {
    return withCronGuard(ctx, "trading-daily-snapshot", async () => {
      // gerçek iş mantığı
      const users = await ctx.db.query("users").collect();
      await Promise.all(users.map(u => snapshotUserPortfolio(ctx, u._id)));
    });
  },
});
```

---

## Cron Seed Mutation (İlk Kurulum)

Tüm cron config'leri DB'ye yazar — deployment sonrası bir kez çalıştırılır:

```typescript
// convex/core/schedule/schedule.business.ts
export const seedCronConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { name: "trading-daily-snapshot", domain: "trading", isEnabled: true, maxConsecutiveFailures: 5 },
      { name: "trading-price-refresh", domain: "trading", isEnabled: true, maxConsecutiveFailures: 10 },
      { name: "notifications-digest", domain: "notifications", isEnabled: true, maxConsecutiveFailures: 3 },
    ];

    for (const config of defaults) {
      const existing = await ctx.db
        .query("cronConfigs")
        .withIndex("by_name", (q) => q.eq("name", config.name))
        .first();

      if (!existing) {
        await ctx.db.insert("cronConfigs", {
          ...config,
          consecutiveFailures: 0,
          description: undefined,
          lastRunAt: undefined,
          lastRunStatus: undefined,
        });
      }
    }
  },
});
```

---

## Convex Workflow ile Karmaşık Süreçler

Basit tek-adımlı schedule'lar için `scheduleTask` yeterlidir.
**Çok adımlı, hata toleranslı süreçler** için `@convex-dev/workflow` kullanılır:

```typescript
// convex/lib/workflow.ts
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

export const workflow = new WorkflowManager(components.workflow);
```

```typescript
// trading.business.ts — karmaşık order workflow
export const orderFulfillmentWorkflow = workflow.define({
  args: { orderId: v.id("trades") },
  handler: async (step, { orderId }) => {
    // Adım 1: Validasyon
    await step.run("validate", async (ctx) => {
      return ctx.runMutation(internal.apps.trading.tradingBusiness.validateOrder, { orderId });
    });

    // Adım 2: Risk kontrolü
    await step.run("risk-check", async (ctx) => {
      return ctx.runMutation(internal.apps.trading.tradingBusiness.checkRisk, { orderId });
    });

    // Adım 3: Exchange'e gönder (retry otomatik)
    const result = await step.run("submit", async (ctx) => {
      return ctx.runAction(internal.apps.trading.tradingIntegration.submitToExchange, { orderId });
    });

    // Adım 4: Teyit
    await step.run("confirm", async (ctx) => {
      return ctx.runMutation(internal.apps.trading.tradingBusiness.confirmOrder, {
        orderId,
        exchangeOrderId: result.orderId,
      });
    });
  },
});

// Workflow başlatma (business mutation'dan)
export const startOrderWorkflow = internalMutation({
  args: { orderId: v.id("trades") },
  handler: async (ctx, { orderId }) => {
    const workflowId = await workflow.start(
      ctx,
      internal.apps.trading.tradingBusiness.orderFulfillmentWorkflow,
      { orderId }
    );
    await ctx.db.patch(orderId, { workflowId });
    return workflowId;
  },
});
```

**Kural:** 2+ adım veya adımlar arası bağımlılık varsa → Workflow. Tek adım → `scheduleTask`.
