# Core Modülü — Genel Bakış

`core/` modülü, CherryJS framework'ünün kendisi tarafından sağlanan altyapıdır.
Domain değil — servistir. İş mantığı taşımaz, domain'lerin ortak ihtiyaçlarını karşılar.

---

## Neden `core/`?

| İhtiyaç | Olmadan | `core/` ile |
|---------|---------|------------|
| Cron on/off | Deploy gerekir | Runtime toggle |
| Dinamik config | Env var + deploy | DB'den anlık okuma |
| Webhook duplicate | Her domain halleder | Merkezi idempotency |
| Schedule takibi | Kaybolur | Tam görünürlük |
| Audit trail | Her domain yazar | Tetikleyici + merkezi |

---

## Core Alt Modülleri

```
convex/core/
│
├── core.schema.ts           # Tüm core tablo tanımları
│
├── schedule/                # Fonksiyonel schedule yönetimi + cron kontrolü
│   ├── schedule.schema.ts   # scheduledTasks, cronConfigs tabloları
│   ├── schedule.model.ts    # DB helper'ları
│   ├── schedule.business.ts # scheduleTask, cancelTask, syncStatus
│   └── schedule.channel.ts  # Admin: list, toggle cron, cancel task
│
├── parameter/               # Runtime dinamik konfigürasyon
│   ├── parameter.model.ts
│   ├── parameter.business.ts  # get, set, delete parameter
│   └── parameter.channel.ts   # Admin: CRUD + public: read
│
├── webhook/                 # Gelen webhook yönetimi
│   ├── webhook.model.ts
│   └── webhook.business.ts  # receiveWebhook (idempotency + routing)
│
└── audit/                   # Audit log altyapısı
    ├── audit.model.ts
    └── audit.business.ts    # logAction, listLogs
```

---

## Katman Kuralları (Core için özel)

Core, domain değildir — ayrı kuralları vardır:

1. **`core/` → domain bağımlılığı yoktur** — `apps/` import etmez
2. **Domain'ler core'u çağırabilir** — `internal.core.*` çağrısı serbesttir
3. **`core/webhook/` channel'ı yoktur** — sadece `http.ts` + internal
4. **`core/audit/` channel'ı yoktur** — sadece triggers + admin query
5. **`core/parameter/` channel'ı vardır** — hem public read hem admin write
6. **`core/schedule/` channel'ı vardır** — sadece admin

---

## core.schema.ts İçeriği

```
scheduledTasks    → Fonksiyonel schedule kayıtları
cronConfigs       → Cron enable/disable konfigürasyonu
parameters        → Runtime dinamik parametreler
webhookEvents     → Gelen webhook olayları (idempotency log)
auditLogs         → Tüm sistem değişiklik kaydı
```

Detaylar: [Schedule](./schedule-management.md) | [Parameter](./parameter-system.md) | [Webhook](./webhook-infrastructure.md) | [Audit](./audit-system.md)

---

## Domain'lerin Core'u Kullanması

```typescript
// trading.business.ts — schedule oluşturma
import { internal } from "../../_generated/api";

export const createTrade = internalMutation({
  handler: async (ctx, args) => {
    const tradeId = await ctx.db.insert("trades", { ...args, status: "pending" });

    // Core schedule ile idempotent zamanlama
    await ctx.runMutation(internal.core.schedule.scheduleBusiness.scheduleTask, {
      name: `order-timeout:${tradeId}`,
      domain: "trading",
      type: "order-timeout",
      functionRef: internal.apps.trading.tradingBusiness.expireOrder,
      args: { tradeId },
      delayMs: 24 * 60 * 60 * 1000,  // 24 saat
      idempotencyKey: `order-timeout:${tradeId}`,
      maxRetries: 0,
    });

    return tradeId;
  },
});

// trading.business.ts — parametreyi oku
const maxQuantity = await ctx.runQuery(
  internal.core.parameter.parameterBusiness.getParameter,
  { key: "max-trade-quantity", domain: "trading", defaultValue: 1000 }
);
```

---

## Görünürlük Matrisi

| Alt Modül | Dış Channel API | Admin Channel API | Internal |
|-----------|-----------------|-------------------|---------|
| `schedule` | ❌ | ✅ | ✅ |
| `parameter` | ✅ (read) | ✅ (write) | ✅ |
| `webhook` | ❌ | ❌ | ✅ |
| `audit` | ❌ | ✅ (read) | ✅ |
