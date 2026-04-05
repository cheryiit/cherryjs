# Schema Organizasyonu

---

## Problem: Tek Dosyada 5000 Satır

Proje büyüdükçe `schema.ts` şişer.
AI, 150+ tablolu bir dosyayı parse etmekte zorlanır.
Pull request diff'leri okunaksız hale gelir.
İki domain aynı alanı değiştirdiğinde merge conflict kaçınılmaz olur.

---

## Çözüm: Domain-Local Schema + Merkezi Aggregator

```
convex/
├── schema.ts                    # ~30 satır — sadece import + defineSchema
├── core/
│   └── core.schema.ts           # Infrastructure tabloları
└── apps/
    ├── users/
    │   └── users.schema.ts
    ├── trading/
    │   └── trading.schema.ts
    └── portfolio/
        └── portfolio.schema.ts
```

**Merkezi aggregator — `convex/schema.ts`:**

```typescript
import { defineSchema } from "convex/server";
import { coreTables } from "./core/core.schema";
import { usersTables } from "./apps/users/users.schema";
import { tradingTables } from "./apps/trading/trading.schema";
import { portfolioTables } from "./apps/portfolio/portfolio.schema";

// Bu dosya sadece combine eder — tablo tanımı içermez
export default defineSchema({
  ...coreTables,
  ...usersTables,
  ...tradingTables,
  ...portfolioTables,
});
```

---

## Domain Schema Dosyası Yapısı

Her domain schema dosyası iki şeyi export eder:
1. `{domain}Tables` — `defineTable()` objeleri (schema'ya girer)
2. `{entity}Fields` — field tanımları (validators'da reuse edilir)

```typescript
// convex/apps/trading/trading.schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

// ── Field Tanımları (Validator olarak reuse için) ─────────────────────────────
export const tradeFields = {
  userId: v.id("users"),
  symbol: v.string(),
  side: literals("buy", "sell"),
  quantity: v.number(),
  price: v.number(),
  status: literals("pending", "filled", "cancelled", "rejected"),
  createdAt: v.number(),
  filledAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  // Schedule tracking
  timeoutTaskId: v.optional(v.id("scheduledTasks")),
};

export const positionFields = {
  userId: v.id("users"),
  symbol: v.string(),
  quantity: v.number(),
  avgEntryPrice: v.number(),
  unrealizedPnl: v.number(),
  updatedAt: v.number(),
};

// ── Tablo Tanımları ───────────────────────────────────────────────────────────
export const tradingTables = {
  trades: defineTable(tradeFields)
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_symbol", ["userId", "symbol"])
    .index("by_status", ["status"])
    .searchIndex("search_by_symbol", {
      searchField: "symbol",
      filterFields: ["userId", "status"],
    }),

  positions: defineTable(positionFields)
    .index("by_user", ["userId"])
    .index("by_user_symbol", ["userId", "symbol"]),
};
```

---

## Field Tanımlarının Reuse Edilmesi

```typescript
// convex/apps/trading/trading.channel.ts
import { tradeFields } from "./trading.schema";
import { partial } from "convex-helpers/validators";

export const create = authenticatedMutation({
  args: {
    symbol: tradeFields.symbol,
    side: tradeFields.side,
    quantity: tradeFields.quantity,
  },
  handler: async (ctx, args) => { ... },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("trades"),
    patch: v.object(partial({
      symbol: tradeFields.symbol,
      quantity: tradeFields.quantity,
    })),
  },
  handler: async (ctx, args) => { ... },
});
```

Schema'yı değiştirirsen validator otomatik güncellenir.

---

## Konvansiyonlar

| Kural | Açıklama |
|-------|---------|
| Domain schema dosyası | `{domain}.schema.ts` |
| Field export adı | `{entity}Fields` (camelCase, tekil) |
| Table export adı | `{domain}Tables` (camelCase, çoğul `Tables` suffix) |
| `schema.ts` sadece aggregate eder | Tablo tanımı içermez |
| Index'ler schema dosyasında | `defineTable().index()` chain |

---

## TypeScript Tip Garantisi

Convex CLI `schema.ts`'teki final `defineSchema()` objesini okur.
Tablo tanımları neredeyse gelsin, CLI doğru `_generated/dataModel.ts`'i üretir.
TypeScript spread operatörü ile birleştirilen objeler tam tip güvenliğini korur.

```typescript
// Bu çalışır — TypeScript spread objelerdeki tipleri birleştirir
const allTables = { ...coreTables, ...tradingTables };
// TypeScript: { auditLogs: TableDef<...>, trades: TableDef<...>, ... }

export default defineSchema(allTables);  // ✅ Tip güvenli
```

---

## PR Review Kuralı

`{domain}.schema.ts` değişikliği → **Schema Review Required**
`schema.ts` değişikliği (yeni domain spread) → sadece aggregator güncellenmiş

Schema PR review'ı: en az 1 başka geliştirici, migration risk değerlendirmesi.
