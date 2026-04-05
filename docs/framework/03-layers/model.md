# Model Katmanı

**Dosya:** `convex/model/{domain}.model.ts`
**Convex türü:** Saf TypeScript fonksiyonları — builder değil

---

## Sorumluluk

Ham veritabanı operasyonları.
Tekrar eden `ctx.db.query(...).withIndex(...)` pattern'lerini tek yerde toplar.
Domain'in tüm katmanları (business, integration gibi) bu helper'ları kullanır.

---

## Katı Kurallar

1. **Builder değil, helper fonksiyon** — `internalQuery` gibi sarma yok
2. **Auth kontrolü yok** — sadece DB işlemi
3. **Business logic yok** — sadece veri çekme/yazma
4. **Hata fırlatma yok** — bulunamazsa `null` döner
5. **İsimlendirme:** `get{Entity}By{Field}` | `list{Entity}By{Field}` | `exists{Entity}By{Field}`
6. **Return tipi açık** — her fonksiyonun dönüş tipi bellidir

---

## Fonksiyon İmzaları

```typescript
// Tek kayıt getir (nullable)
async function get{Entity}(ctx: QueryCtx, id: Id<"table">): Promise<Doc<"table"> | null>

// Index ile tek kayıt
async function get{Entity}By{Field}(ctx: QueryCtx, value: T): Promise<Doc<"table"> | null>

// Çoklu kayıt
async function list{Entity}By{Field}(ctx: QueryCtx, value: T): Promise<Doc<"table">[]>

// Varlık kontrolü
async function exists{Entity}By{Field}(ctx: QueryCtx, value: T): Promise<boolean>
```

---

## Örnek: trade.model.ts

```typescript
// convex/model/trade.model.ts
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

export async function getTradeById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"trades">
): Promise<Doc<"trades"> | null> {
  return ctx.db.get(id);
}

export async function listTradesByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"trades">[]> {
  return ctx.db
    .query("trades")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

export async function listTradesByUserAndStatus(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  status: string
): Promise<Doc<"trades">[]> {
  return ctx.db
    .query("trades")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", status)
    )
    .collect();
}

export async function getTradeByUserAndSymbol(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  symbol: string
): Promise<Doc<"trades"> | null> {
  return ctx.db
    .query("trades")
    .withIndex("by_user_symbol", (q) =>
      q.eq("userId", userId).eq("symbol", symbol)
    )
    .first();
}

export async function existsActiveTradeForSymbol(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  symbol: string
): Promise<boolean> {
  const trade = await ctx.db
    .query("trades")
    .withIndex("by_user_symbol_status", (q) =>
      q.eq("userId", userId).eq("symbol", symbol).eq("status", "pending")
    )
    .first();
  return trade !== null;
}
```

---

## Örnek: user.model.ts

```typescript
// convex/model/user.model.ts
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

export async function getUserById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"users">
): Promise<Doc<"users"> | null> {
  return ctx.db.get(id);
}

export async function getUserByToken(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string
): Promise<Doc<"users"> | null> {
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

export async function getUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<Doc<"users"> | null> {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return getUserByToken(ctx, identity.tokenIdentifier);
}
```

---

## Model vs Business — Sınır

| Model | Business |
|-------|---------|
| `ctx.db.get(id)` | `model.getById(ctx, id); if (!x) throw ...` |
| Sadece döner | Throw eder |
| Filtreleme | Business rule kontrolü |
| Index'e göre sırala | Sayfa limiti, yetki kontrolü |

```typescript
// MODEL — sadece DB
export async function getTradeById(ctx, id) {
  return ctx.db.get(id);  // null olabilir
}

// BUSINESS — model'i kullan + kurallar uygula
export const getTradeForUser = internalQuery({
  handler: async (ctx, { tradeId, userId }) => {
    const trade = await getTradeById(ctx, tradeId);  // model
    if (!trade) throw errors.notFound("Trade");      // business rule
    if (trade.userId !== userId) throw errors.forbidden(); // business rule
    return trade;
  },
});
```
