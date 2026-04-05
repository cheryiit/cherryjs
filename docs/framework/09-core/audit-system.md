# Audit Sistemi

Her önemli değişiklik otomatik olarak `auditLogs` tablosuna yazılır.
Yazma işlemi trigger'lar ile atomiktir — mutation rollback'i audit log'u da geri alır.

---

## Schema

```typescript
// convex/core/audit/audit.schema.ts
export const auditLogFields = {
  // Kim yaptı
  userId: v.optional(v.id("users")),
  userEmail: v.optional(v.string()),       // denormalized — user silinse bile kalır

  // Ne yaptı
  action: v.string(),                      // "{domain}:{entity}:{operation}"
  // Örnekler: "trading:trade:create", "users:user:role-change", "core:parameter:update"

  // Neyi etkiledi
  entityType: v.optional(v.string()),      // "trade", "user", "parameter"
  entityId: v.optional(v.string()),        // _id stringified

  // Değişiklik detayı
  before: v.optional(v.any()),             // Önceki state (hassas alanlar çıkarılmış)
  after: v.optional(v.any()),              // Sonraki state
  metadata: v.optional(v.any()),           // Extra context

  // İstek bilgisi
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),

  timestamp: v.number(),
};

export const auditLogsTables = {
  auditLogs: defineTable(auditLogFields)
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"])
    .index("by_entity", ["entityType", "entityId"]),
};
```

---

## Audit Business Layer

```typescript
// convex/core/audit/audit.business.ts
import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";

// Ana log fonksiyonu — tüm domain'lerden çağrılır
export const log = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string()),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Hassas alanları temizle
    const sanitizedBefore = args.before ? sanitize(args.before) : undefined;
    const sanitizedAfter = args.after ? sanitize(args.after) : undefined;

    return ctx.db.insert("auditLogs", {
      ...args,
      before: sanitizedBefore,
      after: sanitizedAfter,
      timestamp: Date.now(),
    });
  },
});

// Hassas alanları audit log'dan çıkar
function sanitize(obj: any): any {
  const SENSITIVE_FIELDS = ["password", "token", "secret", "apiKey", "privateKey"];
  if (typeof obj !== "object" || obj === null) return obj;
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result) result[field] = "[REDACTED]";
  }
  return result;
}

// Admin: audit log listele
export const listLogs = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    fromTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, action, entityType, entityId, fromTimestamp, limit }) => {
    if (userId) {
      return ctx.db
        .query("auditLogs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit ?? 50);
    }
    if (entityType && entityId) {
      return ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", entityType).eq("entityId", entityId)
        )
        .order("desc")
        .take(limit ?? 50);
    }
    return ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});
```

---

## Trigger ile Otomatik Audit

`triggers.ts` dosyasında domain tabloları için register edilir.
Atomic — mutation başarısız olursa audit log da yazılmaz.

```typescript
// convex/triggers.ts
import { Triggers } from "convex-helpers/server/triggers";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const triggers = new Triggers<DataModel>();

// Users tablosu — her değişikliği logla
triggers.register("users", async (ctx: MutationCtx, change) => {
  const entityId = change.operation === "delete"
    ? String(change.id)
    : String(change.newDoc._id);

  await ctx.db.insert("auditLogs", {
    action: `users:user:${change.operation}`,
    entityType: "user",
    entityId,
    before: change.operation !== "insert" ? sanitizeUser(change.oldDoc) : undefined,
    after: change.operation !== "delete" ? sanitizeUser(change.newDoc) : undefined,
    timestamp: Date.now(),
  });
});

// Trades tablosu — status değişikliklerini logla
triggers.register("trades", async (ctx: MutationCtx, change) => {
  if (change.operation === "update") {
    const statusChanged = change.oldDoc.status !== change.newDoc.status;
    if (!statusChanged) return;  // Sadece status değişimleri

    await ctx.db.insert("auditLogs", {
      action: `trading:trade:status-change`,
      entityType: "trade",
      entityId: String(change.newDoc._id),
      before: { status: change.oldDoc.status },
      after: { status: change.newDoc.status },
      metadata: { userId: change.newDoc.userId },
      timestamp: Date.now(),
    });
  } else if (change.operation === "insert") {
    await ctx.db.insert("auditLogs", {
      action: `trading:trade:create`,
      entityType: "trade",
      entityId: String(change.newDoc._id),
      after: change.newDoc,
      metadata: { userId: change.newDoc.userId },
      timestamp: Date.now(),
    });
  }
});

// Parameters tablosu
triggers.register("parameters", async (ctx: MutationCtx, change) => {
  if (change.operation === "update" || change.operation === "insert") {
    const doc = change.newDoc;
    const before = change.operation === "update" ? change.oldDoc : undefined;

    await ctx.db.insert("auditLogs", {
      action: `core:parameter:${change.operation}`,
      entityType: "parameter",
      entityId: doc.key,
      before: before && !before.isSecret ? { value: before.value } : undefined,
      after: !doc.isSecret ? { value: doc.value } : { value: "[SECRET]" },
      metadata: { domain: doc.domain, updatedBy: doc.updatedBy },
      timestamp: Date.now(),
    });
  }
});

function sanitizeUser(user: any) {
  const { tokenIdentifier, ...safe } = user;
  return safe;
}

export const mutationWithTriggers = triggers.wrapDB(internalMutation);
```

---

## Manuel Audit Log (Trigger Dışı)

Trigger kapsamamayan olaylar için doğrudan log yaz:

```typescript
// trading.business.ts
export const cancelTrade = internalMutation({
  handler: async (ctx, { tradeId, reason, requestingUserId }) => {
    const trade = await ctx.db.get(tradeId);
    if (!trade) throw errors.notFound("Trade");

    await ctx.db.patch(tradeId, { status: "cancelled" });

    // Trigger trade status değişimini otomatik loglar — ek log gerekmez

    // AMA özel context varsa ekle
    if (reason) {
      await ctx.runMutation(internal.core.audit.auditBusiness.log, {
        userId: requestingUserId,
        action: "trading:trade:manual-cancel",
        entityType: "trade",
        entityId: tradeId,
        metadata: { reason },
      });
    }
  },
});
```

---

## Audit Log Retention (Batch)

Eski audit log'ları periyodik temizle:

```typescript
// convex/core/audit/audit.batch.ts
export const batchCleanOldLogs = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;  // 90 gün
    const cutoff = Date.now() - RETENTION_MS;

    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .paginate({ numItems: 200, cursor: cursor ?? null });

    await Promise.all(page.page.map((log) => ctx.db.delete(log._id)));

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        100,
        internal.core.audit.auditBatch.batchCleanOldLogs,
        { cursor: page.continueCursor }
      );
    }

    return { deleted: page.page.length, hasMore: !page.isDone };
  },
});
```

---

## Action Adı Konvansiyonu

```
{domain}:{entity}:{operation}

Örnekler:
trading:trade:create
trading:trade:status-change
trading:trade:cancel
users:user:role-change
users:user:deactivate
core:parameter:update
core:cron:toggle
payments:subscription:activate
```

Audit log action adları `permissions.ts`'teki Permission adlarıyla uyumlu olmalı.
