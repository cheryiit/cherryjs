# Convex Component Kataloğu

Kaynak: /Users/yigitkiraz/cherryjs/docs/internal-docs/components-llms.txt
Toplam: 82 component | Guncelleme: 2026-04-02

## Auth Components

### Rate Limiter
- npm: `@convex-dev/rate-limiter`
- Kategori: backend
- Ozet: Token bucket + fixed window algoritmalari ile type-safe rate limiting. Sharding destekli.
- Dokuman: https://www.convex.dev/components/rate-limiter

### convex-api-keys
- npm: `@00akshatsinha00/convex-api-keys`
- Kategori: auth
- Ozet: API key yonetimi — generation, SHA-256 hashing, verification, rate limiting, RBAC, audit logging.
- Dokuman: https://www.convex.dev/components/00akshatsinha00/convex-api-keys

### oauth-provider
- npm: `@codefox-inc/oauth-provider`
- Kategori: auth
- Ozet: Convex uygulamasini OAuth 2.1 / OIDC provider'a donusturur. PKCE, JWT access tokens, Dynamic Client Registration.
- Dokuman: https://www.convex.dev/components/codefox-inc/oauth-provider

### Better Auth
- npm: `@convex-dev/better-auth`
- Kategori: auth
- Ozet: Better Auth entegrasyonu. React, Vue, Svelte, Next.js gibi framework'lerde calisir.
- Dokuman: https://www.convex.dev/components/better-auth

---

## Database Components

### Aggregate
- npm: `@convex-dev/aggregate`
- Kategori: database
- Ozet: O(log n) count/sum aggregation. Table scan olmadan verimli toplama. Range query destegi.
- Dokuman: https://www.convex.dev/components/aggregate

### Sharded Counter
- npm: `@convex-dev/sharded-counter`
- Kategori: database
- Ozet: Yuksek throughput icin sharded counter. Paralel increment/decrement.
- Dokuman: https://www.convex.dev/components/sharded-counter

### Migrations
- npm: `@convex-dev/migrations`
- Kategori: database
- Ozet: Downtime olmadan uzun surecli data migration. Batch isleme, state tracking, failure recovery.
- Dokuman: https://www.convex.dev/components/migrations

### Geospatial
- npm: `@convex-dev/geospatial`
- Kategori: database
- Ozet: Cografi nokta saklama ve sorgulama. "Bana en yakin X yeri" sorgusu.
- Dokuman: https://www.convex.dev/components/geospatial

### convex-cascading-delete
- npm: `@00akshatsinha00/convex-cascading-delete`
- Kategori: database
- Ozet: Mevcut index'leri kullanarak iliskili dokumanlari otomatik sil. Atomic veya batched mod.
- Dokuman: https://www.convex.dev/components/00akshatsinha00/convex-cascading-delete

---

## Durable Functions

### Workflow
- npm: `@convex-dev/workflow`
- Kategori: durable-functions
- Ozet: Durable execution — server restart'lari ve hatalardan kurtulabilen uzun surecli islemler.
- Dokuman: https://www.convex.dev/components/workflow

### Action Retrier
- npm: `@convex-dev/action-retrier`
- Kategori: durable-functions
- Ozet: Basarisiz action'lari exponential backoff ile otomatik retry.
- Dokuman: https://www.convex.dev/components/retrier

### Crons (Dynamic)
- npm: `@convex-dev/crons`
- Kategori: durable-functions
- Ozet: Runtime'da dinamik cron kayit/guncelleme/silme. Statik crons.ts limitini aser.
- Dokuman: https://www.convex.dev/components/crons

---

## AI Components

### AI Agent
- npm: `@convex-dev/agent`
- Kategori: ai
- Ozet: Agentic AI workflow framework. Persistent message threads, conversation context, vector search, tool calling.
- Dokuman: https://www.convex.dev/components/agent

### RAG
- npm: `@convex-dev/rag`
- Kategori: ai
- Ozet: Retrieval-Augmented Generation. Otomatik chunking, embedding generation, semantic search.
- Dokuman: https://www.convex.dev/components/rag

### Persistent Text Streaming
- npm: `@convex-dev/persistent-text-streaming`
- Kategori: ai
- Ozet: HTTP streaming + database persistence. Real-time LLM output stream + kalici kayit.
- Dokuman: https://www.convex.dev/components/persistent-text-streaming

### Action Cache
- npm: `@convex-dev/action-cache`
- Kategori: backend
- Ozet: Pahalı action sonuclarini TTL ile cache'le (AI calls, external API).
- Dokuman: https://www.convex.dev/components/action-cache

---

## Collaboration

### Presence
- npm: `@convex-dev/presence`
- Kategori: collaboration
- Ozet: Real-time kullanici presence tracking. "Kim online?" Online/offline/last-seen.
- Dokuman: https://www.convex.dev/components/presence

### Collaborative Text Editor Sync
- npm: `@convex-dev/prosemirror-sync`
- Kategori: collaboration
- Ozet: ProseMirror operational transformation ile collaborative editing. Tiptap/BlockNote destegi.
- Dokuman: https://www.convex.dev/components/prosemirror-sync

---

## Integrations

### Resend
- npm: `@convex-dev/resend`
- Kategori: integrations
- Ozet: Resend email servisi entegrasyonu. Queue, batch, retry, rate limiting, idempotency.
- Dokuman: https://www.convex.dev/components/resend

### Twilio SMS
- npm: `@convex-dev/twilio`
- Kategori: integrations
- Ozet: Twilio SMS entegrasyonu. Gelen/giden mesaj, webhook handler.
- Dokuman: https://www.convex.dev/components/twilio

### Cloudflare R2
- npm: `@convex-dev/r2`
- Kategori: integrations
- Ozet: R2 object storage. Signed URL upload, metadata sync.
- Dokuman: https://www.convex.dev/components/cloudflare-r2

### LaunchDarkly Feature Flags
- npm: `@convex-dev/launchdarkly`
- Kategori: integrations
- Ozet: LaunchDarkly feature flag'leri Convex backend'ine entegre et. Real-time sync.
- Dokuman: https://www.convex.dev/components/launchdarkly

### Expo Push Notifications
- npm: `@convex-dev/expo-push-notifications`
- Kategori: integrations
- Ozet: Expo push notification entegrasyonu. Batching, exponential backoff, retry.
- Dokuman: https://www.convex.dev/components/push-notifications

---

## Framework Icin Onemliler

Framework'umuzde kullanilacak component'ler:

| Component | Amac | Oncelik |
|-----------|------|---------|
| `@convex-dev/rate-limiter` | Auth + API rate limiting | Yuksek |
| `@convex-dev/migrations` | Data migration framework | Yuksek |
| `@convex-dev/action-retrier` | Reliable external calls | Orta |
| `@convex-dev/action-cache` | AI/API response caching | Orta |
| `@convex-dev/aggregate` | Count/sum queries | Orta |
| `@convex-dev/workflow` | Complex long-running flows | Dusuk |
| `@convex-dev/crons` | Dynamic cron management | Dusuk |
