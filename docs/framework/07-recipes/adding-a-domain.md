# Yeni Domain Ekleme

Bu rehber, sıfırdan yeni bir domain eklemek için adım adım talimatlar içerir.
Örnek: `portfolio` domain'i ekliyoruz.

---

## Ön Koşul Kontrol

Domain açmadan önce:
- [ ] Kendi DB tablosuna ihtiyaç var mı? → Evet
- [ ] En az 3 public fonksiyon olacak mı? → Evet
- [ ] Başka domain'in sub-özelliği değil mi? → Evet

Tüm `Evet` ise devam et.

---

## Adım 1 — Schema'ya Tablo Ekle

```typescript
// convex/schema.ts
export const portfolioFields = {
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  totalValue: v.number(),
  currency: v.string(),
  isDefault: v.boolean(),
  createdAt: v.number(),
};

export default defineSchema({
  // ... mevcut tablolar
  portfolios: defineTable(portfolioFields)
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),
});
```

**Schema PR review alır — devam etmeden önce merge edilmeli.**

---

## Adım 2 — Model Helper'ı Yaz

```typescript
// convex/model/portfolio.model.ts
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

export async function getPortfolioById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"portfolios">
): Promise<Doc<"portfolios"> | null> {
  return ctx.db.get(id);
}

export async function listPortfoliosByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"portfolios">[]> {
  return ctx.db
    .query("portfolios")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

export async function getDefaultPortfolio(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"portfolios"> | null> {
  return ctx.db
    .query("portfolios")
    .withIndex("by_user_default", (q) =>
      q.eq("userId", userId).eq("isDefault", true)
    )
    .first();
}
```

---

## Adım 3 — Domain Klasörünü Aç

```bash
mkdir -p convex/apps/portfolio
```

Oluşturulacak dosyalar:
```
convex/apps/portfolio/
├── portfolio.business.ts
├── portfolio.channel.ts
└── portfolio.business.test.ts
```

---

## Adım 4 — Business Test'i Yaz (Önce)

```typescript
// convex/apps/portfolio/portfolio.business.test.ts
import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import schema from "../../schema";
import { internal } from "../../_generated/api";

const makeUser = async (ctx: any) =>
  ctx.db.insert("users", {
    tokenIdentifier: "test:user1",
    clerkId: "clerk123",
    name: "Test User",
    email: "test@test.com",
    role: "user",
    isActive: true,
  });

describe("portfolioBusiness.createPortfolio", () => {
  test("başarılı portföy oluşturur", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const userId = await makeUser(ctx);
      const portfolioId = await ctx.runMutation(
        internal.apps.portfolio.portfolioBusiness.createPortfolio,
        { userId, name: "Ana Portföy", currency: "USD" }
      );
      const portfolio = await ctx.db.get(portfolioId);
      expect(portfolio?.name).toBe("Ana Portföy");
      expect(portfolio?.isDefault).toBe(true);  // ilk portföy default
    });
  });

  test("ikinci portföy default değildir", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const userId = await makeUser(ctx);
      await ctx.runMutation(
        internal.apps.portfolio.portfolioBusiness.createPortfolio,
        { userId, name: "Birinci", currency: "USD" }
      );
      const secondId = await ctx.runMutation(
        internal.apps.portfolio.portfolioBusiness.createPortfolio,
        { userId, name: "İkinci", currency: "USD" }
      );
      const second = await ctx.db.get(secondId);
      expect(second?.isDefault).toBe(false);
    });
  });
});
```

Test çalıştır → **RED** (henüz implementasyon yok — beklenen)

---

## Adım 5 — Business Layer'ı Yaz

```typescript
// convex/apps/portfolio/portfolio.business.ts
import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getPortfolioById,
  listPortfoliosByUser,
  getDefaultPortfolio,
} from "../../model/portfolio.model";

export const createPortfolio = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    currency: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, currency, description }) => {
    // İlk portföy mü? Default yap
    const existing = await listPortfoliosByUser(ctx, userId);
    const isDefault = existing.length === 0;

    return ctx.db.insert("portfolios", {
      userId,
      name,
      currency,
      description,
      totalValue: 0,
      isDefault,
      createdAt: Date.now(),
    });
  },
});

export const listByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return listPortfoliosByUser(ctx, userId);
  },
});

export const getById = internalQuery({
  args: { portfolioId: v.id("portfolios"), requestingUserId: v.id("users") },
  handler: async (ctx, { portfolioId, requestingUserId }) => {
    const portfolio = await getPortfolioById(ctx, portfolioId);
    if (!portfolio) throw errors.notFound("Portfolio");
    if (portfolio.userId !== requestingUserId) throw errors.forbidden();
    return portfolio;
  },
});
```

Test çalıştır → **GREEN**

---

## Adım 6 — Channel Layer'ı Yaz

```typescript
// convex/apps/portfolio/portfolio.channel.ts
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { authenticatedQuery, authenticatedMutation } from "../../lib/functions";

export const listMine = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(internal.apps.portfolio.portfolioBusiness.listByUser, {
      userId: ctx.user._id,
    });
  },
});

export const getById = authenticatedQuery({
  args: { portfolioId: v.id("portfolios") },
  handler: async (ctx, { portfolioId }) => {
    return ctx.runQuery(internal.apps.portfolio.portfolioBusiness.getById, {
      portfolioId,
      requestingUserId: ctx.user._id,
    });
  },
});

export const create = authenticatedMutation({
  args: {
    name: v.string(),
    currency: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.apps.portfolio.portfolioBusiness.createPortfolio, {
      userId: ctx.user._id,
      ...args,
    });
  },
});
```

---

## Adım 7 — Frontend Feature Klasörünü Aç

```bash
mkdir -p app/features/portfolio/components
mkdir -p app/features/portfolio/hooks
```

```typescript
// app/features/portfolio/hooks/useMyPortfolios.ts
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";

export function useMyPortfolios() {
  return useSuspenseQuery(
    convexQuery(api.apps.portfolio.portfolioChannel.listMine, {})
  );
}
```

---

## Adım 8 — Route Ekle

```typescript
// app/routes/_authenticated/portfolio/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import { PortfolioList } from "../../../../features/portfolio/components/PortfolioList";

export const Route = createFileRoute("/_authenticated/portfolio/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(
      convexQuery(api.apps.portfolio.portfolioChannel.listMine, {})
    ),
  component: PortfolioList,
});
```

---

## Adım 9 — Architectural Test Çalıştır

```bash
pnpm test:arch
```

Tüm testler geçmeli — geçmiyorsa naming veya import kurallarını düzelt.

---

## Checklist

- [ ] Schema'ya tablo eklendi ve merge edildi
- [ ] `convex/model/portfolio.model.ts` oluşturuldu
- [ ] `convex/apps/portfolio/` klasörü açıldı
- [ ] Business testleri yazıldı (RED)
- [ ] Business layer implement edildi (GREEN)
- [ ] Channel layer yazıldı
- [ ] Frontend hooks oluşturuldu
- [ ] Route eklendi
- [ ] `pnpm test:arch` geçiyor
- [ ] `pnpm typecheck` geçiyor
