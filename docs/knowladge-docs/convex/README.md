# Convex Knowledge Base

Framework'umuz icin toplanan Convex dokumantasyonu.

## Klasor Yapisi

### 01-core — Temel Kavramlar
- `overview.md` — Platform mimarisi, function tipleri, limitler
- `best-practices.md` — 13 best practice + checklist
- `zen-philosophy.md` — Convex tasarim felsefesi

### 02-functions — Fonksiyonlar
- `queries.md` — Okuma fonksiyonlari, ctx, real-time
- `mutations.md` — Yazma fonksiyonlari, transactions
- `actions.md` — External API, runtime secimi
- `validation.md` — Tum validator'lar, v.* API
- `internal-functions.md` — Security boundary
- `error-handling.md` — ConvexError, typed errors
- `http-actions.md` — REST endpoints, Hono

### 03-database — Veritabani
- `schemas.md` — defineSchema, defineTable, iliskiler
- `reading-data.md` — db.get, db.query, result methods
- `writing-data.md` — insert, patch, replace, delete
- `indexes.md` — Index tanimlama, withIndex, range queries
- `pagination.md` — Cursor-based pagination, usePaginatedQuery

### 04-auth — Kimlik Dogrulama
- `overview.md` — Auth mimarisi, provider'lar, flow
- `clerk.md` — Clerk kurulum ve entegrasyon

### 05-scheduling — Zamanlanmis Isler
- `scheduled-functions.md` — runAfter, runAt, iptal
- `cron-jobs.md` — cronJobs(), tum schedule yontemleri

### 06-file-storage — Dosya Depolama
- `file-storage.md` — Upload URL, serve, delete

### 07-search — Arama
- `text-search.md` — Full-text search, Tantivy
- `vector-search.md` — Semantic search, RAG

### 08-components — Hazir Componentler
- `using-components.md` — Component kurulum, kullanim
- `component-catalog.md` — 82 component katalogu

### 09-testing — Test
- `testing.md` — convex-test, Vitest, architectural tests

### 10-production — Production
- `environment-variables.md` — process.env, CLI, limitler

### 11-helpers — convex-helpers Kutuphanesi
- `convex-helpers.md` — Paket ozeti, kategoriler
- `custom-functions.md` — Middleware pattern (EN ONEMLI)
- `relationships.md` — DB iliskiler, getManyFrom vs
- `zod-validation.md` — Zod ile gelismis validation
- `hono-http.md` — Gelismis HTTP routing
- `rate-limiting.md` — Rate limiter component
- `migrations.md` — Data migration pattern'leri

## Hizli Referans

### En Onemli Dosyalar (Framework icin)

1. `11-helpers/custom-functions.md` — Middleware sistemi
2. `02-functions/validation.md` — Validator API
3. `03-database/schemas.md` — Schema tasarimi
4. `02-functions/error-handling.md` — Typed errors
5. `01-core/best-practices.md` — Temel kurallar
6. `04-auth/overview.md` — Auth sistemi
7. `09-testing/testing.md` — Test yazimi

### Kaynaklar

- Docs: https://docs.convex.dev
- Stack Blog: https://stack.convex.dev
- Components: https://convex.dev/components
- llms.txt: https://docs.convex.dev/llms.txt
- GitHub: https://github.com/get-convex/convex-helpers
