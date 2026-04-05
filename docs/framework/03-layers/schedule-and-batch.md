# Schedule ve Batch Katmanları

---

## Schedule Katmanı

**Dosya:** `convex/apps/{domain}/{domain}.schedule.ts`
**Convex türü:** `cronJobs()` + zamanlanmış fonksiyon tanımları

### Sorumluluk

Domain'e özgü cron job'ları ve tekrar eden görevler.
Business logic içermez — yalnızca business katmanını zamanlanmış olarak çağırır.

### Kurallar

1. Her domain'in schedule dosyası kendi cron'larını yönetir
2. Handler'lar business'a delege eder — logic yoktur
3. Cron isimleri `{domain}-{action}` formatındadır
4. UTC timezone kullanılır

### Örnek

```typescript
// convex/apps/trading/trading.schedule.ts
import { cronJobs } from "convex/server";
import { internal } from "../../_generated/api";

const tradingCrons = cronJobs();

// Her gün gece yarısı portföy snapshot
tradingCrons.daily(
  "trading-daily-snapshot",
  { hourUTC: 0, minuteUTC: 0 },
  internal.apps.trading.tradingBusiness.snapshotPortfolios,
  {}
);

// Her 5 dakikada açık position fiyat güncelleme
tradingCrons.interval(
  "trading-price-refresh",
  { minutes: 5 },
  internal.apps.trading.tradingIntegration.refreshOpenPositionPrices,
  {}
);

// Her Pazartesi sabah expired order temizleme
tradingCrons.weekly(
  "trading-cleanup-expired",
  { dayOfWeek: "monday", hourUTC: 6, minuteUTC: 0 },
  internal.apps.trading.tradingBusiness.cleanupExpiredOrders,
  {}
);

export default tradingCrons;
```

### Cron Consolidation

Tüm domain cron'larını tek yerden export etmek için:

```typescript
// convex/crons.ts  (tek dosya — tüm domain cron'ları birleştirilir)
export { default as tradingCrons } from "./apps/trading/trading.schedule";
export { default as notificationCrons } from "./apps/notifications/notifications.schedule";
```

---

## Batch Katmanı

**Dosya:** `convex/apps/{domain}/{domain}.batch.ts`
**Convex türü:** `internalMutation`

### Sorumluluk

Büyük veri setleri üzerinde çalışan işlemler.
Convex'in 10 saniye mutation limiti aşılmadan çalışmak için pagination tabanlı tasarım.
Her execution sınırlı sayıda kayıt işler, gerekirse kendini reschedule eder.

### Kurallar

1. Her execution **100 kayıt** limitiyle çalışır
2. Dönüş tipi: `{ processed: number; hasMore: boolean }`
3. `hasMore: true` ise scheduling ile devam eder
4. Cron ile tetiklenebilir veya tek seferlik çalıştırılabilir
5. Idempotent olmalı — tekrar çalıştırılırsa güvenli

### Temel Batch Pattern

```typescript
// convex/apps/trading/trading.batch.ts
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 100;

export const batchIndexTrades = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    // İşlenecek kayıtları al
    const query = ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "pending"));

    const page = await query
      .paginate({ numItems: BATCH_SIZE, cursor: cursor ?? null });

    // Her kayıt için işlem yap
    await Promise.all(
      page.page.map((trade) =>
        ctx.db.patch(trade._id, { processedAt: Date.now() })
      )
    );

    // Daha fazla kayıt varsa devam et
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.apps.trading.tradingBatch.batchIndexTrades,
        { cursor: page.continueCursor }
      );
    }

    return {
      processed: page.page.length,
      hasMore: !page.isDone,
    };
  },
});
```

### Migration Batch Pattern

Büyük tablo migration'ları için:

```typescript
export const batchMigrateTradeSchema = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { cursor, dryRun = true }) => {
    const page = await ctx.db
      .query("trades")
      .paginate({ numItems: BATCH_SIZE, cursor: cursor ?? null });

    let migrated = 0;
    for (const trade of page.page) {
      // Yeni field yoksa ekle
      if (trade.newField === undefined) {
        if (!dryRun) {
          await ctx.db.patch(trade._id, { newField: computeDefault(trade) });
        }
        migrated++;
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        100, // Rate limiting için küçük delay
        internal.apps.trading.tradingBatch.batchMigrateTradeSchema,
        { cursor: page.continueCursor, dryRun }
      );
    }

    return {
      processed: page.page.length,
      migrated,
      hasMore: !page.isDone,
      dryRun,
    };
  },
});
```

### Batch Başlatma

```typescript
// Tek seferlik çalıştır (mutation'dan)
await ctx.scheduler.runAfter(0, internal.apps.trading.tradingBatch.batchIndexTrades, {});

// Cron ile periyodik çalıştır
tradingCrons.daily(
  "trading-batch-reindex",
  { hourUTC: 3, minuteUTC: 0 },
  internal.apps.trading.tradingBatch.batchIndexTrades,
  {}
);
```

### Batch vs Schedule Karşılaştırması

| Özellik | Schedule | Batch |
|---------|---------|-------|
| Tetikleyici | Zaman | Manuel veya cron |
| Kayıt sayısı | Bağımsız | Sınırlı (100/execution) |
| Self-scheduling | Hayır | Evet (hasMore ise) |
| Kullanım | Periyodik görevler | Büyük veri işleme |
