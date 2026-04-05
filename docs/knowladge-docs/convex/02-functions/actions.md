# Convex Actions

Kaynak: https://docs.convex.dev/functions/actions

## Nedir?

Actions **external API çağrıları** yapabilen, Node.js veya Convex runtime'ında çalışan server fonksiyonlarıdır. Veritabanına **dolaylı** erişir (runQuery/runMutation üzerinden).

## Temel Yapı

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { to, subject, body }) => {
    // External API çağrısı
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ to, subject, html: body }),
    });
  },
});
```

## Context (ctx) Nesnesi

`ActionCtx` içerdiği alanlar:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `ctx.runQuery` | Function | Query çalıştır |
| `ctx.runMutation` | Function | Mutation çalıştır |
| `ctx.runAction` | Function | Action çalıştır (kaçın!) |
| `ctx.auth` | `Auth` | Auth token bilgisi |
| `ctx.storage` | `StorageWriter` | File storage |
| `ctx.scheduler` | `Scheduler` | Function scheduling |
| `ctx.vectorSearch` | Function | Vector search |

## Runtime Seçimi

### Convex Runtime (Default)
```typescript
export const myAction = action({
  handler: async (ctx, args) => {
    // Hızlı, cold start yok
    // fetch() desteklenir
    // Sınırlı npm package desteği
  }
});
```

### Node.js Runtime
```typescript
"use node"; // Dosyanın en üstüne ekle

import { action } from "./_generated/server";

export const myNodeAction = action({
  handler: async (ctx, args) => {
    // Node.js API'leri kullanılabilir
    // npm paketleri tam destek
    // Daha yavaş, cold start olabilir
  }
});
```

**Not:** `"use node"` direktifi olan dosyada başka Convex fonksiyonu tanımlanamaz.

## Doğru Kullanım Paterni

```typescript
// ❌ Anti-pattern — browser'dan direkt action çağırma
const result = await callAction(api.ai.generateText, { prompt });

// ✅ Doğru — mutation intent kaydeder, action schedule eder
export const requestGeneration = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    const jobId = await ctx.db.insert("jobs", {
      prompt,
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.ai.processGeneration, { jobId });
    return jobId;
  },
});

export const processGeneration = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const result = await callOpenAI(/* ... */);
    await ctx.runMutation(internal.jobs.complete, { jobId, result });
  },
});
```

## Limitler

| Özellik | Limit |
|---------|-------|
| Max süre | 10 dakika |
| Memory (Convex runtime) | 64MB |
| Memory (Node.js runtime) | 512MB |
| Concurrent | 1,000 |
| Scheduling | 1,000 per call, 8MB args |

## Error Handling

Actions **auto-retry edilmez** — side effects var. Caller kendi retry mantığını yazmalı:

```typescript
const sendEmail = useAction(api.emails.send);

const handleSend = async () => {
  try {
    await sendEmail({ to, subject, body });
  } catch (error) {
    // Manuel retry veya kullanıcıya hata göster
    console.error("Email failed:", error);
  }
};
```
