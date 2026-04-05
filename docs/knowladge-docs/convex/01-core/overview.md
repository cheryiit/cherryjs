# Convex Platform Overview

## Ne Nedir?

Convex, **reaktif veritabanı + serverless functions + real-time sync** içeren entegre bir backend platformdur. Geleneksel backend'lerde ayrı olan database, API ve realtime katmanlarını tek çatı altında birleştirir.

## Mimari

```
Client (React/TanStack)
    ↕ WebSocket / HTTP
Convex Backend
    ├── Queries      → Okuma, cached, reactive
    ├── Mutations    → Yazma, transactional
    ├── Actions      → External API çağrıları
    └── HTTP Actions → REST endpoint'leri
    ↕
Convex Database
    ├── Documents (JSON-like)
    ├── Indexes
    ├── Scheduled Functions
    └── File Storage
```

## Temel Özellikler

### 1. Reaktif Sorgular
- `useQuery()` hook'u ile client otomatik güncellenir
- Data değiştiğinde tüm subscriberlar anında güncellenir
- Manuel polling/refresh gerekmez

### 2. End-to-End Type Safety
- Schema'dan TypeScript tiplerine otomatik üretim
- `Doc<"tableName">` ile tip güvenli döküman erişimi
- Function argümanları ve return değerleri runtime'da validate edilir

### 3. Transactional Mutations
- Optimistic concurrency control (OCC)
- Her mutation atomic — ya hepsi ya hiçbiri
- Otomatik retry çakışma durumunda

### 4. Serverless Architecture
- Altyapı yönetimi yok
- Otomatik scaling
- Cold start yok (Convex runtime için)

## Function Tipleri

| Tip | Kullanım | DB Erişimi | External API |
|-----|----------|------------|--------------|
| `query` | Okuma | ✅ | ❌ |
| `mutation` | Yazma | ✅ | ❌ |
| `action` | Harici işlemler | Dolaylı | ✅ |
| `httpAction` | REST endpoint | Dolaylı | ✅ |
| `internalQuery` | Internal okuma | ✅ | ❌ |
| `internalMutation` | Internal yazma | ✅ | ❌ |
| `internalAction` | Internal harici | Dolaylı | ✅ |

## Deployment URL'leri

- **Backend**: `https://<project>.convex.cloud`
- **HTTP Actions**: `https://<project>.convex.site`

## Limitler

| Özellik | Limit |
|---------|-------|
| Mutation/Query süresi | 1 dakika |
| Action süresi | 10 dakika |
| Döküman boyutu | 1MB |
| Array boyutu | 8,192 element |
| Object property | 1,024 entry |
| Concurrent connections | 1,000 |
| Environment variables | 100 |
| Indexes per table | 32 |
| Fields per index | 16 |

## Kaynak
- Docs: https://docs.convex.dev
- Stack (blog): https://stack.convex.dev
- LLMs.txt: https://docs.convex.dev/llms.txt
