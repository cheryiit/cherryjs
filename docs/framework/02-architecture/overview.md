# Mimari Genel Bakış

CherryJS iki temel taraftan oluşur: **Convex backend** ve **TanStack Start frontend**.
Bu iki taraf arasındaki sınır, Convex'in reaktif sorgu sistemi ile köprülenir.

---

## Yüksek Seviye Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TanStack Start                            │
│                                                                   │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │  Routes  │ →  │   Features   │ ←  │  Convex React Hooks    │ │
│  │ (thin)   │    │ (components  │    │  useSuspenseQuery()     │ │
│  │          │    │  + hooks)    │    │  useMutation()          │ │
│  └──────────┘    └──────────────┘    └────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │ WebSocket / HTTP
┌────────────────────────────────▼────────────────────────────────┐
│                           Convex                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    apps/{domain}/                         │   │
│  │                                                           │   │
│  │  ┌───────────┐  ┌────────────┐  ┌──────────────────────┐│   │
│  │  │  channel  │→ │  business  │→ │     integration       ││   │
│  │  │ (public)  │  │ (internal) │  │  (internalAction)     ││   │
│  │  └───────────┘  └─────┬──────┘  └──────────────────────┘│   │
│  │                        │                                   │   │
│  │                 ┌──────▼──────┐                           │   │
│  │                 │    model    │                           │   │
│  │                 │  (db only)  │                           │   │
│  │                 └─────────────┘                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  schema   │  │  lib/       │  │ triggers │  │  http.ts  │  │
│  │ (kontrat) │  │ (framework) │  │ (events) │  │  (Hono)   │  │
│  └───────────┘  └─────────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bağımlılık Yönü (Dependency Direction)

```
channel  ──→  lib/functions (wrapper seçimi)
channel  ──→  internal.apps.{domain}.business.* (çağrı)
business ──→  lib/errors
business ──→  lib/permissions
business ──→  model/{domain}
business ──→  internal.apps.{domain}.integration.* (gerekirse)
integration ──→  lib/errors (sadece)
model    ──→  _generated/dataModel (tip için)
```

**Yasaklı yönler:**
```
❌ business  → başka domain'in db tablosu
❌ channel   → model (channel, business'ı bypass edemez)
❌ channel   → business logic (if-else koyamaz)
❌ model     → lib/errors (model sadece null döner, throw etmez)
```

---

## Domain Sayısı ve Büyüklüğü

Bir domain şu durumlarda kendi apps/ klasörüne layık olur:
- Kendine ait en az bir DB tablosu varsa
- En az 3 farklı public fonksiyonu varsa
- Başka bir domain'in sub-fonksiyonu değilse

Örnek domain dağılımı:

```
apps/
├── users/        → Kullanıcı yönetimi
├── auth/         → Oturum, session
├── trading/      → Trade işlemleri
├── portfolio/    → Portföy takibi
├── notifications/→ Bildirimler
└── admin/        → Admin araçları
```

---

## Convex API Hiyerarşisi

Convex'in `api` ve `internal` nesneleri şu yapıyı izler:

```typescript
// Public (client çağırabilir)
api.apps.trading.tradingChannel.createTrade

// Internal (sadece server-side)
internal.apps.trading.tradingBusiness.processOrder
internal.apps.trading.tradingIntegration.fetchMarketPrice
```

Fonksiyon path'i dizin yapısını yansıtır:
`convex/apps/trading/trading.channel.ts` → `api.apps.trading.tradingChannel.*`

---

## SSR + Reaktif Senkronizasyon

```
Server (SSR)                    Client
─────────────────────           ─────────────────────
loader → ensureQueryData    →   hydrate → useSuspenseQuery
                                              ↓
                                    WebSocket subscription
                                    (otomatik, Convex sağlar)
```

SSR sırasında Convex verisini preload et → client'ta hydration gap'i olmadan
aynı query reaktif hale gelir. Ayrıca cache senkronize edilmesi gerekmez.
