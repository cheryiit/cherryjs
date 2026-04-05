# Parameter Sistemi

Runtime'da değiştirilebilen konfigürasyon değerleri.
Deploy gerektirmez — admin dashboard'dan veya API'den anlık değişir.

---

## Environment Variable vs Parameter

| Özellik | Environment Variable | Parameter |
|---------|---------------------|-----------|
| Değiştirme | Deploy gerekir | Anında |
| Görünürlük | Sadece server | DB'den okunabilir |
| Tip güvenliği | String | Typed (number, bool, json) |
| Kullanım | API keys, URLs | Business config |
| Gizlilik | Her zaman gizli | `isSecret: true` ile |

**Kural:** Güvenlik bilgileri (API key, secret) → ENV. İş parametreleri → Parameter.

```
ENV:    EXCHANGE_API_KEY, RESEND_API_KEY, CONVEX_DEPLOYMENT
Param:  max-trades-per-user, maintenance-mode, fee-percentage
```

---

## Schema

```typescript
// convex/core/parameter/parameter.schema.ts
export const parameterFields = {
  key: v.string(),                              // "max-trades-per-user"
  value: v.any(),                               // 100
  valueType: literals("string", "number", "boolean", "json"),
  domain: v.optional(v.string()),               // "trading" | undefined = global
  description: v.optional(v.string()),
  isSecret: v.boolean(),                        // true → value masked in admin UI
  updatedAt: v.number(),
  updatedBy: v.optional(v.id("users")),
};

export const parametersTables = {
  parameters: defineTable(parameterFields)
    .index("by_key", ["key"])
    .index("by_domain_key", ["domain", "key"]),
};
```

---

## Business Layer

```typescript
// convex/core/parameter/parameter.business.ts

// Parametre oku — type-safe default değer
export const getParameter = internalQuery({
  args: {
    key: v.string(),
    domain: v.optional(v.string()),
    defaultValue: v.optional(v.any()),
  },
  handler: async (ctx, { key, domain, defaultValue }) => {
    // Önce domain-spesifik, yoksa global bak
    let param = null;
    if (domain) {
      param = await ctx.db
        .query("parameters")
        .withIndex("by_domain_key", (q) => q.eq("domain", domain).eq("key", key))
        .first();
    }
    if (!param) {
      param = await ctx.db
        .query("parameters")
        .withIndex("by_domain_key", (q) =>
          q.eq("domain", undefined).eq("key", key)
        )
        .first();
    }

    return param?.value ?? defaultValue ?? null;
  },
});

// Tip-güvenli helper'lar
export const getStringParameter = internalQuery({
  args: { key: v.string(), domain: v.optional(v.string()), defaultValue: v.string() },
  handler: async (ctx, { key, domain, defaultValue }) => {
    const value = await getParameterValue(ctx, key, domain);
    return typeof value === "string" ? value : defaultValue;
  },
});

export const getNumberParameter = internalQuery({
  args: { key: v.string(), domain: v.optional(v.string()), defaultValue: v.number() },
  handler: async (ctx, { key, domain, defaultValue }) => {
    const value = await getParameterValue(ctx, key, domain);
    return typeof value === "number" ? value : defaultValue;
  },
});

export const getBooleanParameter = internalQuery({
  args: { key: v.string(), domain: v.optional(v.string()), defaultValue: v.boolean() },
  handler: async (ctx, { key, domain, defaultValue }) => {
    const value = await getParameterValue(ctx, key, domain);
    return typeof value === "boolean" ? value : defaultValue;
  },
});

// Admin: parametre yaz
export const setParameter = internalMutation({
  args: {
    key: v.string(),
    value: v.any(),
    valueType: literals("string", "number", "boolean", "json"),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    isSecret: v.optional(v.boolean()),
    updatedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("parameters")
      .withIndex("by_domain_key", (q) =>
        q.eq("domain", args.domain).eq("key", args.key)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        valueType: args.valueType,
        description: args.description ?? existing.description,
        isSecret: args.isSecret ?? existing.isSecret,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
      return existing._id;
    } else {
      return ctx.db.insert("parameters", {
        ...args,
        isSecret: args.isSecret ?? false,
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## Domain'de Kullanım

```typescript
// trading.business.ts

export const createTrade = internalMutation({
  args: { userId: v.id("users"), symbol: v.string(), quantity: v.number() },
  handler: async (ctx, { userId, symbol, quantity }) => {

    // 1. Maintenance mode kontrolü (global)
    const inMaintenance = await ctx.runQuery(
      internal.core.parameter.parameterBusiness.getBooleanParameter,
      { key: "maintenance-mode", defaultValue: false }
    );
    if (inMaintenance) throw errors.forbidden("Sistem bakımda, işlemler geçici olarak durduruldu");

    // 2. Domain-spesifik limit
    const maxQuantity = await ctx.runQuery(
      internal.core.parameter.parameterBusiness.getNumberParameter,
      { key: "max-trade-quantity", domain: "trading", defaultValue: 1000 }
    );
    if (quantity > maxQuantity) throw errors.validation(`Maksimum işlem miktarı: ${maxQuantity}`);

    // 3. Fee oranı
    const feePercentage = await ctx.runQuery(
      internal.core.parameter.parameterBusiness.getNumberParameter,
      { key: "fee-percentage", domain: "trading", defaultValue: 0.1 }
    );

    // ...
  },
});
```

---

## Seed Mutation (Initial Parameters)

```typescript
// convex/core/parameter/parameter.business.ts
export const seedDefaultParameters = internalMutation({
  handler: async (ctx) => {
    const defaults: Array<{
      key: string;
      value: any;
      valueType: "string" | "number" | "boolean" | "json";
      domain?: string;
      description: string;
    }> = [
      // Global
      { key: "maintenance-mode", value: false, valueType: "boolean", description: "Tüm sistemi bakıma al" },
      { key: "new-user-registration", value: true, valueType: "boolean", description: "Yeni kayıt açık/kapalı" },

      // Trading
      { key: "max-trade-quantity", value: 1000, valueType: "number", domain: "trading", description: "Tek işlemde max miktar" },
      { key: "fee-percentage", value: 0.1, valueType: "number", domain: "trading", description: "İşlem ücreti (%)" },
      { key: "max-open-positions", value: 10, valueType: "number", domain: "trading", description: "Max açık pozisyon" },
    ];

    for (const param of defaults) {
      const existing = await ctx.db
        .query("parameters")
        .withIndex("by_domain_key", (q) =>
          q.eq("domain", param.domain).eq("key", param.key)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("parameters", {
          ...param,
          isSecret: false,
          updatedAt: Date.now(),
        });
      }
    }
  },
});
```

---

## Channel Layer (Admin API)

```typescript
// convex/core/parameter/parameter.channel.ts

// Public: global read-only parametreler (secret olmayanlar)
export const getPublicConfig = publicQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(internal.core.parameter.parameterBusiness.listPublicParameters, {});
  },
});

// Admin: tüm parametreler
export const list = adminQuery({
  args: { domain: v.optional(v.string()) },
  handler: async (ctx, { domain }) => {
    return ctx.runQuery(internal.core.parameter.parameterBusiness.listParameters, { domain });
  },
});

// Admin: parametre yaz
export const set = adminMutation({
  args: {
    key: v.string(),
    value: v.any(),
    valueType: literals("string", "number", "boolean", "json"),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(internal.core.parameter.parameterBusiness.setParameter, {
      ...args,
      updatedBy: ctx.user._id,
    });
  },
});
```
