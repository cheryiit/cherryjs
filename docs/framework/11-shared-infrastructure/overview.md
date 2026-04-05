# Shared Infrastructure — Genel Bakış

`convex/lib/` dizini, projenin tüm ortak altyapısını içerir.
Framework kurulduktan sonra bu dosyalar nadiren değişir.
Her domain, kendi implementasyonunu yazmak yerine buradan import eder.

---

## lib/ Tam Haritası

```
convex/lib/
│
├── functions.ts         # Middleware pipeline — tüm function wrapper'ları
├── errors.ts            # ErrorCode + ConvexError factory (errors.*)
├── permissions.ts       # RBAC — Role, Permission, hasPermission, canPerform
├── rls.ts               # Row-Level Security kuralları
│
├── rate-limiter.ts      # @convex-dev/rate-limiter instance + tüm limit config'leri
├── retrier.ts           # @convex-dev/action-retrier instance
├── workflow.ts          # @convex-dev/workflow manager instance
├── aggregate.ts         # @convex-dev/aggregate instance'ları
│
├── request-context.ts   # RequestContext type + ctx injection helper'ları
├── audit.ts             # Audit log helper — ctx.audit.log() pattern
│
├── pagination.ts        # getPage, QueryStreams, Paginator wrapper'ları
├── relationships.ts     # getAll, getManyFrom, getManyVia wrapper'ları
├── storage.ts           # File storage — upload, serve, delete helper'ları
├── search.ts            # Text search + vector search helper'ları
└── validators.ts        # nullable, literals, partial, branded — proje geneli
```

---

## Hangi lib Modülü Ne Zaman Kullanılır

| İhtiyaç | lib/ modülü | Anti-pattern (kullanma) |
|---------|------------|------------------------|
| Rate limiting | `rate-limiter.ts` → wrapper kullan | Manuel counter tutma |
| Action retry | `retrier.ts` → `retrier.run()` | `try/catch + setTimeout` |
| Karmaşık workflow | `workflow.ts` → `workflow.define()` | İç içe `scheduler.runAfter` |
| Sayım/aggregate | `aggregate.ts` → instance | `COUNT(*)` gibi `.collect().length` |
| Çoklu ID fetch | `relationships.ts` → `getAllOrThrow` | `Promise.all(ids.map(ctx.db.get))` |
| Join (1-to-many) | `relationships.ts` → `getManyFrom` | İç içe query |
| Sayfalama | `pagination.ts` → `getPage` | Manual cursor yönetimi |
| File upload | `storage.ts` → `generateUploadUrl` | Direkt API çağrısı |
| Text arama | `search.ts` → `searchText` | `LIKE %query%` pattern |
| IP/UserAgent log | `request-context.ts` → ctx.requestMeta | Her yerde ayrı okuma |
| Audit yazma | `audit.ts` → `ctx.audit.log()` | `ctx.db.insert("auditLogs", ...)` direkt |
| Error fırlatma | `errors.ts` → `errors.notFound()` | `throw new Error("not found")` |

---

## Architectural Test Enforcement

Her modülün kullanımı architectural testlerle enforce edilir:
- Modülü kullanmadan yapılan anti-pattern → **test fail**
- Modülü hiç import etmeden yapılan benzer iş → **test warning** (advisory)

---

## Setup Özeti

```typescript
// convex/convex.config.ts — Tüm component'ler burada declare edilir
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(actionRetrier);
app.use(workflow);
app.use(aggregate);

export default app;
```
