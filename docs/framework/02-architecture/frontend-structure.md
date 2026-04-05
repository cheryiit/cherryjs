# Frontend Yapısı — TanStack Start

---

## Dizin Ağacı

```
app/
│
├── routes/                      # Dosya tabanlı routing — SADECE ROUTING
│   ├── __root.tsx               # Global provider'lar (Clerk, Convex, QueryClient)
│   ├── _authenticated.tsx       # Auth guard layout
│   ├── _public.tsx              # Giriş yapmamış layout (varsa)
│   │
│   ├── index.tsx                # /
│   ├── sign-in.tsx              # /sign-in
│   ├── sign-up.tsx              # /sign-up
│   │
│   └── _authenticated/
│       ├── dashboard.tsx        # /dashboard
│       ├── profile.tsx          # /profile
│       └── trading/
│           ├── index.tsx        # /trading
│           └── $tradeId.tsx     # /trading/:tradeId
│
├── features/                    # Domain feature modülleri — ASIL KOD
│   ├── trading/
│   │   ├── components/
│   │   │   ├── TradeList.tsx
│   │   │   ├── TradeCard.tsx
│   │   │   └── CreateTradeForm.tsx
│   │   ├── hooks/
│   │   │   ├── useMyTrades.ts
│   │   │   └── useCreateTrade.ts
│   │   └── types.ts             # Domain'e özgü TypeScript tipleri
│   │
│   └── users/
│       ├── components/
│       │   └── ProfileCard.tsx
│       └── hooks/
│           └── useCurrentUser.ts
│
├── components/                  # Paylaşılan UI
│   ├── ui/                      # Design system (shadcn/ui benzeri atomlar)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Dialog.tsx
│   └── layout/                  # App shell
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       └── Header.tsx
│
├── lib/                         # Altyapı — nadiren değişir
│   ├── convex.ts                # Convex client + ConvexQueryClient setup
│   └── auth.tsx                 # Auth helper'ları
│
├── utils/                       # Saf utility fonksiyonlar
│   ├── format.ts                # Para, tarih, sayı formatlama
│   └── validation.ts            # Zod schema'ları (form validation)
│
├── router.tsx                   # Router factory (SSR + QueryClient setup)
├── client.tsx                   # Client entry point
└── ssr.tsx                      # SSR entry point
```

---

## Route Dosyası — Ne İçerir?

Route dosyası **sadece şunları** içerir:
1. `createFileRoute` tanımı
2. `loader` — SSR için Convex query preload
3. `component` — feature'dan import edilen component

```typescript
// app/routes/_authenticated/trading/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { TradeList } from "../../../features/trading/components/TradeList";

export const Route = createFileRoute("/_authenticated/trading/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(convexQuery(api.apps.trading.tradingChannel.listMine, {})),
  component: TradeList,   // ← Feature'dan import, inline JSX YOK
});
```

Route dosyasında **olmaz**:
- JSX component kodu
- useState, useEffect
- Business logic
- Hardcoded veri

---

## Feature Modülü — Ne İçerir?

```
features/trading/
├── components/
│   ├── TradeList.tsx       — veriyi hook'tan alır, render eder
│   ├── TradeCard.tsx       — tek trade card (dumb component)
│   └── CreateTradeForm.tsx — form + mutation
├── hooks/
│   ├── useMyTrades.ts      — Convex query wrapper
│   └── useCreateTrade.ts   — Convex mutation wrapper
└── types.ts                — Lokal tip augmentation (gerekirse)
```

### Hook Örneği

```typescript
// features/trading/hooks/useMyTrades.ts
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";

export function useMyTrades() {
  return useSuspenseQuery(
    convexQuery(api.apps.trading.tradingChannel.listMine, {})
  );
}
```

Hook, Convex API path'ini kapsüller.
Component, Convex hakkında hiçbir şey bilmez.

### Mutation Hook Örneği

```typescript
// features/trading/hooks/useCreateTrade.ts
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useCreateTrade() {
  return useMutation(api.apps.trading.tradingChannel.createTrade);
}
```

### Component Örneği

```typescript
// features/trading/components/TradeList.tsx
import { useMyTrades } from "../hooks/useMyTrades";
import { TradeCard } from "./TradeCard";

export function TradeList() {
  const { data: trades } = useMyTrades();

  if (trades.length === 0) return <p>Henüz trade yok.</p>;

  return (
    <ul>
      {trades.map((trade) => (
        <TradeCard key={trade._id} trade={trade} />
      ))}
    </ul>
  );
}
```

---

## components/ui/ — Design System

Atomic, headless veya styled component'ler.
Feature bileşimlerinden **bağımsız** — domain bilmez.

```
Button, Input, Select, Dialog, Sheet, Toast,
Card, Badge, Spinner, Avatar, Tooltip, Popover,
Table, Pagination, ...
```

Her biri kendi dosyasında — barrel export ile `components/ui/index.ts`.

---

## lib/ vs utils/ Farkı

| `lib/` | `utils/` |
|--------|----------|
| Altyapı setup (Convex client, auth) | Saf fonksiyonlar (format, parse) |
| Side effect içerebilir | Side effect içermez |
| Singleton/global state | Stateless |
| Nadiren değişir | Gerektiğinde genişler |

---

## _authenticated.tsx — Auth Guard

```typescript
// app/routes/_authenticated.tsx
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const auth = await getAuth(context.request!);
    if (!auth.userId) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: () => <Outlet />,
});
```

Bu layout altındaki tüm route'lar otomatik korunur.
Her sayfada ayrı auth kontrolü yazmak gerekmez.

---

## SSR + Convex Hydration

```typescript
// app/routes/_authenticated/trading/index.tsx
loader: ({ context: { queryClient } }) =>
  queryClient.ensureQueryData(convexQuery(api.apps.trading.tradingChannel.listMine, {})),
```

`ensureQueryData` hem SSR'da hem client'ta çalışır:
- **SSR'da**: Veriyi fetch eder, HTML'e gömer
- **Client'ta**: Cache'te varsa fetch etmez
- **Subscription**: `useSuspenseQuery` ile WebSocket subscription başlar

Ekstra cache invalidation gerekmez — Convex reaktif olarak günceller.
