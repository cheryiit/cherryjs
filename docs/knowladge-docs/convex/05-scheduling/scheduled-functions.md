# Convex Scheduled Functions

Kaynak: https://docs.convex.dev/scheduling/scheduled-functions

## Nedir?

Gelecekte calistirilmak uzere fonksiyonlari zamanlamak. Veritabaninda saklanir — sistem kesintisine karsi dayanikli.

## Temel Kullanim

```typescript
// runAfter — ms cinsinden gecikme
await ctx.scheduler.runAfter(
  5000,                              // 5 saniye sonra
  internal.emails.sendWelcome,       // SADECE internal fonksiyon
  { userId }                         // argümanlar
);

// runAt — exact timestamp
await ctx.scheduler.runAt(
  new Date("2025-12-01T10:00:00Z"),  // Date objesi
  internal.reports.generateMonthly,
  {}
);

// runAt — Unix ms
await ctx.scheduler.runAt(
  Date.now() + 24 * 60 * 60 * 1000, // 24 saat sonra
  internal.cleanup.deleteExpired,
  {}
);
```

## Mutation'dan Scheduling

```typescript
export const registerUser = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    const userId = await ctx.db.insert("users", {
      email, name, status: "pending"
    });
    
    // Atomik: mutation basarisiz olursa scheduling de iptal
    await ctx.scheduler.runAfter(
      0, // hemen
      internal.emails.sendWelcomeEmail,
      { userId }
    );
    
    // 7 gun sonra onboarding emaili
    await ctx.scheduler.runAfter(
      7 * 24 * 60 * 60 * 1000,
      internal.emails.sendOnboarding,
      { userId }
    );
    
    return userId;
  },
});
```

## Action'dan Scheduling

```typescript
export const processPayment = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    try {
      await chargeCard(/* ... */);
      await ctx.runMutation(internal.orders.markPaid, { orderId });
    } catch (error) {
      // Retry 5 dakika sonra
      await ctx.scheduler.runAfter(
        5 * 60 * 1000,
        internal.payments.retryPayment,
        { orderId }
      );
    }
  },
});
```

## Scheduled Function ID ile Iptal

```typescript
export const scheduleReminder = mutation({
  args: { taskId: v.id("tasks"), dueDate: v.number() },
  handler: async (ctx, { taskId, dueDate }) => {
    const scheduledId = await ctx.scheduler.runAt(
      dueDate - 60 * 60 * 1000, // 1 saat once
      internal.reminders.send,
      { taskId }
    );
    
    // ID'yi kaydet — iptal etmek icin
    await ctx.db.patch("tasks", taskId, { reminderId: scheduledId });
    return scheduledId;
  },
});

export const cancelReminder = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (task?.reminderId) {
      await ctx.scheduler.cancel(task.reminderId);
      await ctx.db.patch("tasks", taskId, { reminderId: undefined });
    }
  },
});
```

## Sistem Tablosu

```typescript
// _scheduled_functions tablosuna erisim
const scheduled = await ctx.db.system
  .query("_scheduled_functions")
  .filter(q => q.eq(q.field("state.kind"), "pending"))
  .collect();
```

## Status Degerler

| Status | Aciklama |
|--------|----------|
| `pending` | Zamanlanmis, henuz baslamadi |
| `inProgress` | Calistirilıyor |
| `success` | Basariyla tamamlandi |
| `failed` | Hata ile tamamlandi |
| `canceled` | Iptal edildi |

Sonuclar 7 gun saklanir.

## Limitler

| Ozellik | Limit |
|---------|-------|
| Tek cagride max schedule | 1,000 fonksiyon |
| Toplam arguman boyutu | 8MB |
| Gecmis saklama | 7 gun |

## Distributed Job Queue Pattern

```typescript
// Producer
export const enqueueJobs = mutation({
  args: { items: v.array(v.string()) },
  handler: async (ctx, { items }) => {
    await Promise.all(
      items.map((item, i) =>
        ctx.scheduler.runAfter(
          i * 100, // Staggered — her 100ms bir job
          internal.jobs.process,
          { item }
        )
      )
    );
  },
});

// Consumer
export const process = internalAction({
  args: { item: v.string() },
  handler: async (ctx, { item }) => {
    // Her item ayri transaction'da islenir
  },
});
```
