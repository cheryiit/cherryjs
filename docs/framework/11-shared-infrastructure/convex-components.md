# Convex Components — Ortak Altyapı

`@convex-dev/*` paketleri Convex component sistemi üzerinden çalışır.
Her biri `convex.config.ts`'te declare edilir ve ilgili `lib/` dosyasından kullanılır.
**Doğrudan import yerine her zaman lib/ wrapper'ı kullan.**

---

## @convex-dev/rate-limiter

`lib/rate-limiter.ts` → Bkz. `rate-limiter.md`

```typescript
// KULLAN
import { rateLimiter } from "../../lib/rate-limiter";
await rateLimiter.limit(ctx, "normal", { key: ctx.user._id });

// KULLANMA
import { RateLimiter } from "@convex-dev/rate-limiter"; // direkt import
const rl = new RateLimiter(components.rateLimiter, { ... }); // yeni instance
```

---

## @convex-dev/action-retrier

`lib/retrier.ts` — Güvenilir action execution. Network hataları ve geçici başarısızlıklar için.

```typescript
// convex/lib/retrier.ts

import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1_000,   // İlk retry: 1sn
  base: 2,                   // Exponential: 1s, 2s, 4s, 8s...
  maxFailures: 4,             // Max 4 başarısız deneme
});
```

### Kullanım

```typescript
// apps/trading/trading.integration.ts

import { retrier } from "../../lib/retrier";
import { internal } from "../../_generated/api";

export const submitOrderWithRetry = internalAction({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    // retrier.run() → başarısız olursa otomatik retry
    await retrier.run(ctx, internal.apps.trading.tradingIntegration.submitOrder, {
      tradeId,
    });
  },
});

export const submitOrder = internalAction({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const response = await fetch("https://exchange.api/orders", { ... });
    if (!response.ok) throw new Error("Exchange rejected"); // retrier yakalar
    // ...
  },
});
```

### Ne Zaman Kullanılır

| Durum | retrier | scheduler |
|-------|---------|-----------|
| Network hatası → tekrar dene | ✅ | ❌ |
| İş mantığı hatası → hata fırlat | ❌ | ❌ |
| Belirli bir saatte çalış | ❌ | ✅ |
| Dış API entegrasyonu | ✅ | ❌ |
| DB mutation | ❌ | ❌ (direkt kullan) |

---

## @convex-dev/workflow

`lib/workflow.ts` — Durable multi-step workflows. Adımlar arasında sistem çökmesi olsa bile kaldığı yerden devam eder.

```typescript
// convex/lib/workflow.ts

import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

export const workflow = new WorkflowManager(components.workflow);
```

### Kullanım

```typescript
// apps/trading/trading.business.ts

import { workflow } from "../../lib/workflow";
import { internal } from "../../_generated/api";
import { v } from "convex/values";

// Workflow tanımı
export const tradeWorkflow = workflow.define({
  args: { userId: v.id("users"), symbol: v.string(), quantity: v.number() },
  handler: async (step, { userId, symbol, quantity }) => {

    // Step 1: Bakiye kontrol
    const hasBalance = await step.runQuery(
      internal.apps.trading.tradingBusiness.checkBalance,
      { userId, symbol, quantity }
    );
    if (!hasBalance) throw errors.custom("INSUFFICIENT_FUNDS", "...");

    // Step 2: Order submit (dış API — başarısız olabilir, workflow kaldığı yerden devam)
    const orderId = await step.runAction(
      internal.apps.trading.tradingIntegration.submitOrder,
      { userId, symbol, quantity }
    );

    // Step 3: DB güncelle
    await step.runMutation(
      internal.apps.trading.tradingBusiness.confirmTrade,
      { userId, orderId }
    );

    return { orderId };
  },
});

// Workflow başlatma
export const startTrade = internalMutation({
  args: { userId: v.id("users"), symbol: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    const workflowId = await workflow.start(ctx, internal.apps.trading.tradingBusiness.tradeWorkflow, args);
    return workflowId;
  },
});
```

### Ne Zaman Kullanılır

```
2+ adım + her adım başarısız olabilir → workflow
Tek action → retrier
Basit mutation chain → normal internalMutation
Zamanlı iş → scheduler + internalMutation
```

---

## @convex-dev/aggregate

`lib/aggregate.ts` — Gerçek zamanlı sayım/toplam. `collect().length` yerine kullan.

```typescript
// convex/lib/aggregate.ts

import { TableAggregate } from "@convex-dev/aggregate";
import { DataModel } from "../_generated/dataModel";
import { components } from "../_generated/api";

// Her tablo için ayrı aggregate instance

export const tradeCountAggregate = new TableAggregate<
  DataModel,
  "trades",
  { userId: string }
>(components.aggregate, {
  sortKey: (doc) => doc._creationTime,
  sumValue: (_doc) => 1,  // sayım için 1
});

export const tradeVolumeAggregate = new TableAggregate<
  DataModel,
  "trades",
  { userId: string }
>(components.aggregate, {
  sortKey: (doc) => doc._creationTime,
  sumValue: (doc) => doc.quantity,  // miktar toplamı
});
```

### triggers.ts'te Aggregate Sync

Aggregate'in güncel kalması için her DB write'ta trigger ile sync edilmeli:

```typescript
// convex/triggers.ts

import { Triggers } from "convex-helpers/server/triggers";
import { tradeCountAggregate, tradeVolumeAggregate } from "./lib/aggregate";

const triggers = new Triggers<DataModel>();

triggers.register("trades", async (ctx, change) => {
  await tradeCountAggregate.trigger(ctx, change);
  await tradeVolumeAggregate.trigger(ctx, change);
});

export default triggers;
```

### Kullanım

```typescript
// apps/trading/trading.business.ts

import { tradeCountAggregate, tradeVolumeAggregate } from "../../lib/aggregate";

export const getTradeStats = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const count = await tradeCountAggregate.count(ctx, {
      lower: { key: 0, id: "min" as any },
      upper: { key: Date.now(), id: "max" as any },
    });

    const volume = await tradeVolumeAggregate.sum(ctx, {
      lower: { key: 0, id: "min" as any },
      upper: { key: Date.now(), id: "max" as any },
    });

    return { count, volume };
  },
});
```

### Anti-Pattern

```typescript
// ❌ YAPMA — O(n) işlem, her call'da tüm docs çekilir
const trades = await ctx.db.query("trades").collect();
const count = trades.length;

// ✅ YAP — O(log n), aggregate'ten oku
const count = await tradeCountAggregate.count(ctx, bounds);
```

---

## convex-helpers

Convex resmi helper paketi. `npm install convex-helpers`

### relationships.ts

```typescript
// convex/lib/relationships.ts

export { getAll, getManyFrom, getManyVia } from "convex-helpers/server/relationships";
```

```typescript
// Kullanım — apps/*/**.business.ts

import { getAll, getManyFrom } from "../../lib/relationships";

// Çoklu ID fetch — Promise.all(ids.map(ctx.db.get)) yerine
const trades = await getAll(ctx.db, tradeIds); // (Doc | null)[]
const tradesOrError = await getAllOrThrow(ctx.db, tradeIds); // throws if any null

// 1-to-many join — iç içe query yerine
const userTrades = await getManyFrom(ctx.db, "trades", "by_user", userId);
```

### pagination.ts

```typescript
// convex/lib/pagination.ts

export { getPage } from "convex-helpers/server/pagination";
```

```typescript
// Kullanım

import { getPage } from "../../lib/pagination";

export const listTrades = authenticatedQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .paginate(paginationOpts);
  },
});
```

### CRUD Helpers

```typescript
// Basit CRUD — boilerplate azaltır
import { crud } from "convex-helpers/server/crud";
import schema from "../schema";

// Model katmanında kullanılabilir
export const { create, read, update, destroy } = crud(schema, "notifications");
```

---

## Architectural Test — Shared Infrastructure Usage

```typescript
// tests/architectural/shared-infrastructure.test.ts

import { describe, it, expect } from "vitest";
import { glob } from "glob";
import * as fs from "fs";

describe("Shared Infrastructure Usage", () => {

  // ── Aggregate Anti-Pattern ─────────────────────────────────────────────────

  it("should not use collect().length for counting", () => {
    const files = glob.sync("convex/apps/**/*.{business,channel}.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      // .collect() ardından .length veya bir değişkene atanıp .length
      if (/\.collect\(\)[\s\S]{0,50}\.length/.test(content)) {
        violations.push(file);
      }
    });

    expect(violations).toEqual([]);
  });

  // ── Relationship Anti-Pattern ──────────────────────────────────────────────

  it("should not use Promise.all(ids.map(ctx.db.get)) for multi-fetch", () => {
    const files = glob.sync("convex/apps/**/*.{business,channel}.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes("Promise.all") &&
        content.includes("ctx.db.get") &&
        content.includes(".map(")
      ) {
        violations.push(file);
      }
    });

    expect(violations).toEqual([]);
  });

  // ── Pagination Anti-Pattern ────────────────────────────────────────────────

  it("should not manually manage pagination cursors", () => {
    const files = glob.sync("convex/apps/**/*.channel.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      // Manuel cursor yönetimi — getPage ya da .paginate() yerine
      if (
        content.includes("isDone") &&
        !content.includes("paginate(") &&
        !content.includes("getPage(")
      ) {
        violations.push(file);
      }
    });

    expect(violations).toEqual([]);
  });

  // ── Retrier Anti-Pattern ────────────────────────────────────────────────────

  it("should not use try/catch + scheduler for retry logic in actions", () => {
    const files = glob.sync("convex/apps/**/*.integration.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes("catch") &&
        content.includes("scheduler.runAfter") &&
        !content.includes("retrier.run")
      ) {
        violations.push(`${file}: use retrier.run() instead of try/catch + scheduler`);
      }
    });

    expect(violations).toEqual([]);
  });

  // ── Workflow Anti-Pattern ──────────────────────────────────────────────────

  it("should not have deeply nested scheduler.runAfter chains (3+ levels)", () => {
    const files = glob.sync("convex/apps/**/*.business.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/scheduler\.runAfter/g) ?? [];
      // 3+ scheduler.runAfter aynı dosyada → workflow olmalı
      if (matches.length >= 3) {
        violations.push(`${file}: ${matches.length} scheduler.runAfter calls — consider @convex-dev/workflow`);
      }
    });

    // Bu warning — fail değil (advisory)
    if (violations.length > 0) {
      console.warn("⚠️ Potential workflow candidates:\n" + violations.join("\n"));
    }
    // Zorunlu değil — advisory only
  });

  // ── Direct Error Throw ─────────────────────────────────────────────────────

  it("should not throw raw Error objects", () => {
    const files = glob.sync("convex/apps/**/*.{business,channel,integration}.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (
          /throw new Error\(/.test(line) &&
          !line.includes("// cherry:allow")
        ) {
          violations.push(`${file}:${i + 1}: use errors.* instead of new Error()`);
        }
      });
    });

    expect(violations).toEqual([]);
  });

  // ── Direct Audit Insert ────────────────────────────────────────────────────

  it("should not directly insert into auditLogs", () => {
    const files = glob.sync("convex/apps/**/*.{business,channel}.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes('"auditLogs"') &&
        content.includes("ctx.db.insert")
      ) {
        violations.push(`${file}: use ctx.audit.log() instead`);
      }
    });

    expect(violations).toEqual([]);
  });

  // ── Direct fetch() in Non-Integration ─────────────────────────────────────

  it("should not use fetch() outside integration files", () => {
    const files = glob.sync("convex/apps/**/*.{business,channel,model,batch}.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (
          /\bfetch\(/.test(line) &&
          !line.includes("// cherry:allow")
        ) {
          violations.push(`${file}:${i + 1}: fetch() only allowed in .integration.ts`);
        }
      });
    });

    expect(violations).toEqual([]);
  });

  // ── Direct scheduler in channel ───────────────────────────────────────────

  it("should not use ctx.scheduler directly in channel files", () => {
    const files = glob.sync("convex/apps/**/*.channel.ts");
    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("ctx.scheduler")) {
        violations.push(`${file}: use scheduleTask() from core/schedule instead`);
      }
    });

    expect(violations).toEqual([]);
  });
});
```

---

## Özet: Hangi lib Modülü Hangi Katmanda

| lib Modülü | channel | business | integration | model |
|-----------|---------|----------|-------------|-------|
| `functions.ts` | ✅ (wrapper) | ❌ | ❌ | ❌ |
| `errors.ts` | ✅ | ✅ | ✅ | ❌ |
| `rate-limiter.ts` | ✅ (wrapper içinde) | ❌ | ❌ | ❌ |
| `relationships.ts` | ❌ | ✅ | ❌ | ✅ |
| `pagination.ts` | ✅ | ✅ | ❌ | ❌ |
| `aggregate.ts` | ❌ | ✅ | ❌ | ❌ |
| `retrier.ts` | ❌ | ❌ | ✅ | ❌ |
| `workflow.ts` | ❌ | ✅ | ❌ | ❌ |
| `audit.ts` | ❌ | ✅ | ❌ | ❌ |
| `storage.ts` | ✅ | ✅ | ❌ | ❌ |
| `search.ts` | ❌ | ✅ | ❌ | ❌ |
