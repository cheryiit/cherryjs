# Convex Internal Functions

Kaynak: https://docs.convex.dev/functions/internal-functions

## Nedir?

Internal functions sadece **diğer Convex fonksiyonları** tarafından çağrılabilir — client erişemez. Security boundary oluşturur.

## Tipler

```typescript
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
```

## Neden Kullanmalı?

```
Public API (client erişebilir)
    ↓ auth check
    ↓ arg validation
    ↓ business rule check
Internal Functions (sadece backend)
    ↓ güvenli işlemler
    ↓ sistem operasyonları
```

**Örnek risk:** Ücretsiz plan upgrade endpoint'i public olursa, malicious user doğrudan çağırabilir.

## Tanımlama

```typescript
// convex/plans.ts

// Internal — doğrudan çağrılamaz
export const markAsProfessional = internalMutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    await ctx.db.patch("plans", planId, { type: "professional" });
  },
});

export const getPlanDetails = internalQuery({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    return ctx.db.get(planId);
  },
});

export const syncWithStripe = internalAction({
  args: { customerId: v.string() },
  handler: async (ctx, { customerId }) => {
    const data = await fetch(`https://api.stripe.com/customers/${customerId}`);
    // ...
  },
});
```

## Çağırma Yolları

```typescript
// 1. Action'dan
export const processPayment = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    // runQuery / runMutation ile internal çağır
    const order = await ctx.runQuery(internal.orders.getOrder, { orderId });
    await ctx.runMutation(internal.orders.markPaid, { orderId });
  },
});

// 2. Scheduler ile
export const scheduleCleanup = mutation({
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      24 * 60 * 60 * 1000, // 24 saat sonra
      internal.cleanup.deleteOldData,
      {}
    );
  },
});

// 3. Cron ile
const crons = cronJobs();
crons.daily(
  "daily-cleanup",
  { hourUTC: 2, minuteUTC: 0 },
  internal.cleanup.deleteOldData,
  {}
);
```

## Public + Internal Pattern

```typescript
// Public wrapper — auth + validation
export const upgradeToPro = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    
    // Payment verification, eligibility check...
    const isEligible = await verifyPayment(userId);
    if (!isEligible) throw new ConvexError({ code: "PAYMENT_REQUIRED" });
    
    // Internal mutation ile güvenli upgrade
    await ctx.runMutation(internal.plans.markAsProfessional, { userId });
  },
});

// Internal — güvende, doğrudan çağrılamaz
export const markAsProfessional = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch("users", userId, { plan: "professional" });
  },
});
```

## Import Yapısı

```typescript
// Public functions → api objesinden
import { api } from "./_generated/api";
ctx.runQuery(api.users.getUser, { id });  // ❌ Actions'ta anti-pattern

// Internal functions → internal objesinden
import { internal } from "./_generated/api";
ctx.runMutation(internal.plans.markAsPro, { planId }); // ✅
```
