# İsimlendirme Kuralları

Tüm isimler için tek referans nokta burasıdır.
Bir ismin nasıl olacağından emin değilsen bu dosyaya bak.

---

## Dosya İsimleri

### Backend (Convex)

| Dosya | Format | Örnek |
|-------|--------|-------|
| Domain channel | `{domain}.channel.ts` | `trading.channel.ts` |
| Domain business | `{domain}.business.ts` | `trading.business.ts` |
| Domain integration | `{domain}.integration.ts` | `trading.integration.ts` |
| Domain schedule | `{domain}.schedule.ts` | `trading.schedule.ts` |
| Domain batch | `{domain}.batch.ts` | `trading.batch.ts` |
| Model helper | `{domain}.model.ts` | `trade.model.ts` |
| Test dosyası | `{domain}.{layer}.test.ts` | `trading.business.test.ts` |

**Çok kelimeli domain:** `user-profile` → `user-profile.channel.ts`

### Frontend (TanStack Start)

| Dosya | Format | Örnek |
|-------|--------|-------|
| Route (index) | `index.tsx` | `routes/trading/index.tsx` |
| Route (dynamic) | `$paramName.tsx` | `routes/trading/$tradeId.tsx` |
| Layout route | `_name.tsx` | `routes/_authenticated.tsx` |
| Component | `PascalCase.tsx` | `TradeCard.tsx` |
| Hook | `use{Name}.ts` | `useMyTrades.ts` |
| Types | `types.ts` | `features/trading/types.ts` |
| Utility | `camelCase.ts` | `utils/format.ts` |

---

## Fonksiyon İsimleri — Backend

### Channel Layer (Public API)

CRUD operasyonları için standart isimler:

| İşlem | Tekil | Çoğul |
|-------|-------|-------|
| Oku | `getById` | `list` |
| Oluştur | `create` | — |
| Güncelle | `update` | — |
| Sil | `remove` (delete değil) | — |
| Ara | `search` | — |
| Sahip kayıtlar | `listMine` | — |

```typescript
// ✅ Standart channel fonksiyon isimleri
export const getById = authenticatedQuery({ ... });
export const list = authenticatedQuery({ ... });
export const listMine = authenticatedQuery({ ... });
export const create = authenticatedMutation({ ... });
export const update = authenticatedMutation({ ... });
export const remove = authenticatedMutation({ ... });
```

### Business Layer (Internal)

Business layer isimleri channel'dan daha açıklayıcıdır:

```typescript
// Prefix: domain adı + işlem
export const createTrade = internalMutation({ ... });
export const cancelTrade = internalMutation({ ... });
export const confirmExchangeOrder = internalMutation({ ... });
export const listTradesByUser = internalQuery({ ... });
export const getTradeForUser = internalQuery({ ... });

// State transition'lar fiille başlar
export const markTradeAsFilled = internalMutation({ ... });
export const markTradeAsExpired = internalMutation({ ... });

// Aggregate / computed
export const calculatePortfolioValue = internalQuery({ ... });
export const snapshotPortfolios = internalMutation({ ... });
```

### Integration Layer

```typescript
// Dış sistem adı + işlem
export const submitToExchange = internalAction({ ... });
export const fetchMarketPrice = internalAction({ ... });
export const sendOrderConfirmationEmail = internalAction({ ... });
```

### Schedule / Batch

```typescript
// Schedule: run + PascalCase
export const runDailySnapshot = internalMutation({ ... });
export const runExpiredOrderCleanup = internalMutation({ ... });

// Batch: batch + PascalCase
export const batchIndexTrades = internalMutation({ ... });
export const batchSendDigestEmails = internalMutation({ ... });
```

### Model Layer

```typescript
// get + {Entity} + by? + {Field}
export async function getTradeById(ctx, id) { ... }
export async function getTradeByUserAndSymbol(ctx, userId, symbol) { ... }
export async function listTradesByUser(ctx, userId) { ... }
export async function listTradesByStatus(ctx, status) { ... }
export async function existsActiveTradeForSymbol(ctx, userId, symbol) { ... }
```

---

## TypeScript Tipleri ve Enum'lar

### Enum / Const Object

```typescript
// ✅ Const object (Convex uyumlu, tree-shakeable)
export const TradeStatus = {
  PENDING: "pending",
  FILLED: "filled",
  CANCELLED: "cancelled",
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

// ✅ Permission, ErrorCode, Role aynı şekilde
export const ErrorCode = { ... } as const;
export const Permission = { ... } as const;
export const Role = { ... } as const;
```

### Interface vs Type

```typescript
// Interface: genişletilebilir şeyler için (nesne şekli)
interface TradeWithAuthor extends Doc<"trades"> {
  author: Doc<"users">;
}

// Type: union, intersection, computed için
type TradeStatus = "pending" | "filled" | "cancelled";
type TradeSide = "buy" | "sell";
```

---

## Fonksiyon İsimleri — Frontend

### Hook'lar

```typescript
// Query hook: use + {domain} + {Description}
export function useMyTrades() { ... }
export function useTrade(tradeId: Id<"trades">) { ... }
export function usePortfolioValue() { ... }

// Mutation hook: use + {Action} + {Domain}
export function useCreateTrade() { ... }
export function useCancelTrade() { ... }
export function useUpdateProfile() { ... }
```

### Component'ler

```typescript
// PascalCase, domain adı prefix'i gerekmez (features/ klasöründe zaten domain belli)
export function TradeList() { ... }
export function TradeCard({ trade }: { trade: Doc<"trades"> }) { ... }
export function CreateTradeForm() { ... }

// Layout'lar için Layout suffix
export function AppShell() { ... }
export function DashboardLayout() { ... }
```

---

## Yasaklı İsimler

| Yasak | Neden | Doğrusu |
|-------|-------|---------|
| `data` (genel) | Anlamsız | `trades`, `user`, `portfolioValue` |
| `handleX` (component içinde) | Çok genel | `handleCreateTrade`, `handleCancelClick` |
| `utils.ts` (domain olmadan) | Nereye koyacağını bilmiyorsun | `utils/format.ts`, `utils/validation.ts` |
| `helper.ts` | `model.ts` veya `utils/` tercih et | alan göre grupla |
| `index.ts` (barrel) | Convex'te barrel export yok | doğrudan import |
| `types.ts` (global) | Her domain kendi tiplerini yönetir | `features/{domain}/types.ts` |
