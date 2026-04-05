# Row-Level Security (RLS)

Kaynak: https://stack.convex.dev/row-level-security
GitHub: https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/rowLevelSecurity.ts

## Ne Zaman Gerekli?

> Convex CTO: "Most Convex apps **don't need** row-level security."

Çünkü Convex'te veri erişimi zaten server functions üzerinden geçer — her fonksiyonda manual auth check yapılabilir.

**RLS kullan:**
- Büyük uygulamalarda her fonksiyona auth check eklemek yerine merkezi kural tanımlamak istersen
- `ctx.db.query()` her çağrısında otomatik filtreleme istersen
- IDOR (Insecure Direct Object Reference) açıklarını mimari seviyede kapatmak istersen

---

## Exported API

```typescript
import {
  wrapDatabaseReader,   // Okuma kuralları uygular
  wrapDatabaseWriter,   // Yazma kuralları uygular
} from "convex-helpers/server/rowLevelSecurity";
```

---

## Rules Tipi

```typescript
type Rules<Ctx, DataModel> = {
  [TableName in keyof DataModel]?: {
    read?:   (ctx: Ctx, doc: Document) => Promise<boolean>;
    modify?: (ctx: Ctx, doc: Document) => Promise<boolean>;
    insert?: (ctx: Ctx, doc: Document) => Promise<boolean>;
  }
}
```

- `read` — `db.get()` ve `db.query()` sonuçlarını filtreler
- `modify` — `db.patch()`, `db.replace()`, `db.delete()` için kontrol
- `insert` — `db.insert()` için kontrol

**defaultPolicy:**
- `"allow"` (default) — Kural tanımlanmamış tablolar için izin ver
- `"deny"` — Kural tanımlanmamış tablolar için reddet

---

## Tam Örnek

```typescript
// convex/lib/rls.ts
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import type { DataModel } from "../_generated/dataModel";
import type { Auth } from "convex/server";

type RLSCtx = {
  auth: Auth;
  userId?: string; // tokenIdentifier
};

// Kurallar tanımla
const rules = {
  // Mesajlar: sadece yayınlananlar veya kendi yazılanlar
  messages: {
    read: async (ctx: RLSCtx, doc: any) => {
      if (doc.published) return true;
      const identity = await ctx.auth.getUserIdentity();
      return identity?.tokenIdentifier === doc.authorId;
    },
    modify: async (ctx: RLSCtx, doc: any) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return false;
      return identity.tokenIdentifier === doc.authorId;
    },
    insert: async (ctx: RLSCtx, doc: any) => {
      const identity = await ctx.auth.getUserIdentity();
      return !!identity; // Sadece giriş yapmışlar
    },
  },

  // Profiller: herkes okur, sadece kendisi düzenler
  profiles: {
    read: async () => true, // Herkes görebilir
    modify: async (ctx: RLSCtx, doc: any) => {
      const identity = await ctx.auth.getUserIdentity();
      return identity?.tokenIdentifier === doc.ownerId;
    },
    insert: async (ctx: RLSCtx, doc: any) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return false;
      // Sadece kendi profilini oluşturabilir
      return doc.ownerId === identity.tokenIdentifier;
    },
  },

  // Yönetici tabloları — default deny ile
  adminLogs: {
    read: async (ctx: RLSCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      // TODO: admin check
      return false;
    },
  },
} satisfies Parameters<typeof wrapDatabaseReader>[2];

// Custom functions ile entegrasyon
export function withRLS<Ctx extends { auth: Auth; db: any }>(ctx: Ctx) {
  return {
    ...ctx,
    db: {
      ...wrapDatabaseReader({ auth: ctx.auth }, ctx.db, rules),
      ...wrapDatabaseWriter({ auth: ctx.auth }, ctx.db, rules),
    },
  };
}
```

---

## Custom Functions ile Kullanım

```typescript
// convex/lib/functions.ts
import { customQuery, customMutation } from "convex-helpers/server/customFunctions";
import { query, mutation } from "./_generated/server";
import { withRLS } from "./rls";

// RLS uygulanmış query
export const rlsQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({
    ctx: withRLS(ctx),
    args: {},
  }),
});

// RLS uygulanmış mutation
export const rlsMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({
    ctx: withRLS(ctx),
    args: {},
  }),
});
```

---

## Kullanım

```typescript
// convex/functions/messages.ts
import { rlsQuery, rlsMutation } from "../lib/functions";
import { v } from "convex/values";

// RLS otomatik uygulanır — read kuralına göre filter
export const listMessages = rlsQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    // Sadece kullanıcının görebildiği mesajlar döner
    // "read" kuralı otomatik apply edilir
    return ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();
  },
});

export const createMessage = rlsMutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
  },
  handler: async (ctx, { channelId, body }) => {
    // "insert" kuralı otomatik kontrol edilir
    // Kural başarısız olursa hata fırlatır
    return ctx.db.insert("messages", {
      channelId,
      body,
      published: false,
    });
  },
});
```

---

## defaultPolicy: "deny"

Hassas veriler için tüm tablolara explicit kural zorunluluğu:

```typescript
const secureRules = { /* tablo kuralları */ };

// Kural tanımlanmamış tablo → otomatik reddet
const db = wrapDatabaseReader(ctx, ctx.db, secureRules, {
  defaultPolicy: "deny",
});
```

---

## Hata Mesajları

RLS ihlalinde fırlatılan hatalar:

```
"read access not allowed"     — read kuralı false döndü
"insert access not allowed"   — insert kuralı false döndü
"write access not allowed"    — modify kuralı false döndü
```

---

## Ne Zaman RLS Yerine Manuel Check Kullan?

```typescript
// RLS yerine — daha az sihir, daha okunabilir
export const updatePost = authenticatedMutation({
  args: { postId: v.id("posts"), title: v.string() },
  handler: async (ctx, { postId, title }) => {
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError({ code: "NOT_FOUND" });
    if (post.authorId !== ctx.user._id)
      throw new ConvexError({ code: "UNAUTHORIZED" });
    await ctx.db.patch("posts", postId, { title });
  },
});
```

**Tavsiye:** Küçük-orta uygulamalarda manuel check tercih et. RLS'yi büyük/karmaşık uygulamalarda merkezi yönetim için kullan.
