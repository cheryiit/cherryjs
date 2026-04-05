# CherryJS Framework — Mimari Dokümantasyon

Bu dizin, CherryJS framework'ünün kendi kurallarını, kararlarını ve mimarisini tanımlar.
`knowladge-docs/` referans dokümanlar içerir (Convex, TanStack API'leri).
Bu dizin ise **bizim** neyi, neden, nasıl yaptığımızı tanımlar.

---

## Bölümler

| # | Bölüm | İçerik |
|---|-------|--------|
| 01 | [Felsefe](./01-philosophy/) | Prensipler, development metodolojisi |
| 02 | [Mimari](./02-architecture/) | Proje yapısı, dizin ağacı, bağımlılık grafiği |
| 03 | [Katmanlar](./03-layers/) | Channel, Business, Integration, Model, Schedule, Batch |
| 04 | [Konvansiyonlar](./04-conventions/) | İsimlendirme, dosya yerleştirme, import kuralları |
| 05 | [Yetkilendirme](./05-authorization/) | RBAC, RLS, function wrapper'ları |
| 06 | [Test Stratejisi](./06-testing/) | Test piramidi, architectural testler, unit testler |
| 07 | [Tarifler](./07-recipes/) | Yeni domain ekleme, integration ekleme |
| 08 | [Schema Organizasyonu](./08-schema/) | Domain-local schema, aggregator pattern |
| 09 | [Core Modülü](./09-core/) | Schedule, Parameter, Webhook, Audit altyapısı |
| 10 | [Middleware](./10-middleware/) | Convex function pipeline, Hono HTTP middleware, TanStack Start middleware |
| 11 | [Shared Infrastructure](./11-shared-infrastructure/) | lib/ modülleri, rate limiter, request context, audit, convex components |

---

## Hızlı Referans

### Yeni bir özellik eklerken sor:

1. **Hangi domain?** → `convex/apps/{domain}/`
2. **Hangi katman?** → [Dosya Yerleştirme Kararı](./04-conventions/file-placement.md)
3. **Hangi wrapper?** → [Yetkilendirme](./05-authorization/function-wrappers.md)
4. **Test ettim mi?** → [Test Stratejisi](./06-testing/strategy.md)

### Altın Kurallar (ezber)

```
channel     →  sadece public API, business logic YOK
business    →  sadece internalMutation/internalQuery, tüm mantık burada
model       →  sadece ham DB operasyonları, auth YOK
integration →  sadece dış API çağrıları, DB YOK
core/       →  framework altyapısı, domain DEĞİL
```

```
throw new Error(...)          ❌
throw errors.notFound()       ✅

authenticatedMutation({...})  ❌  (channel'da doğrudan — rate limit yok)
normalMutation({...})         ✅  (rate limited wrapper)

.collect().length             ❌  (O(n) — tüm docs çekilir)
aggregate.count(ctx, bounds)  ✅  (O(log n))

fetch("https://api.io")       ❌  (business/channel'da)
fetch("https://api.io")       ✅  (integration.ts'te)

ctx.db.insert("auditLogs")   ❌
ctx.audit.log({...})          ✅

import { query } from "../_generated/server"       ❌  (apps/ içinde)
import { authenticatedQuery } from "../lib/functions"  ✅

ctx.db.query("users") in trading.business.ts       ❌  (cross-domain DB)
ctx.runQuery(internal.apps.users.usersBusiness.getUser) ✅
```

### Core Modülü Quick Reference

```
Dinamik config?          → core/parameter
Schedule takibi?         → core/schedule → scheduleTask()
Cron on/off?             → cronConfigs tablosu + withCronGuard()
Webhook işleme?          → core/webhook → receiveWebhook()
Audit log?               → triggers.ts → otomatik
Karmaşık workflow?       → @convex-dev/workflow
```

---

## Stack

| Katman | Teknoloji |
|--------|-----------|
| Backend | Convex |
| Frontend | TanStack Start |
| Auth | Clerk |
| HTTP | Hono (Convex HTTP Actions) |
| Validation | Convex v.*, Zod |
| Rate Limiting | @convex-dev/rate-limiter |
| Helpers | convex-helpers |
