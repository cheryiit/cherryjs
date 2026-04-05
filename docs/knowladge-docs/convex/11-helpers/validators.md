# Validator Utilities

Kaynak: convex-helpers/validators

## Neden?

Convex'in `v.object()` validator'ı güçlüdür ama bazı pattern'ler tekrara yol açar. convex-helpers bu boşlukları doldurur.

---

## Exported Utilities

```typescript
import {
  nullable,
  literals,
  partial,
  brandedString,
  deprecated,
  validate,
  tableHelper,
  systemFields,
  withSystemFields,
} from "convex-helpers/validators";
```

---

## nullable — Kısayol

```typescript
import { nullable } from "convex-helpers/validators";

// v.union(v.string(), v.null()) ile aynı
const field = nullable(v.string());
// string | null
```

---

## literals — Union Kısayolu

```typescript
import { literals } from "convex-helpers/validators";

// v.union(v.literal("a"), v.literal("b"), v.literal("c")) ile aynı
const role = literals("admin", "user", "moderator");
// "admin" | "user" | "moderator"
```

---

## partial — Tüm Alanları Optional

```typescript
import { partial } from "convex-helpers/validators";

const userFields = {
  name: v.string(),
  email: v.string(),
  bio: v.string(),
};

// Patch için — tüm alanlar optional
const userPatchFields = partial(userFields);
// { name?: string; email?: string; bio?: string }

export const updateUser = mutation({
  args: { id: v.id("users"), patch: v.object(userPatchFields) },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch("users", id, patch);
  },
});
```

---

## brandedString — Domain Types

Farklı string türlerini tip sisteminde ayırt et:

```typescript
import { brandedString } from "convex-helpers/validators";

// Email ve URL aynı string ama karıştırmak istemiyorsun
const emailValidator = brandedString("email");
const urlValidator = brandedString("url");

type Email = typeof emailValidator._type; // string & { __brand: "email" }
type Url = typeof urlValidator._type;     // string & { __brand: "url" }

// Tip güvenli fonksiyon
function sendEmail(to: Email, url: Url) { /* ... */ }

// Yanlış sıra → compile error
sendEmail(url, email); // ❌ Type Error
sendEmail(email, url); // ✅
```

---

## deprecated — Migration Sırasında

```typescript
import { deprecated } from "convex-helpers/validators";

// Schema migration sırasında eski alanı işaretle
const userFields = {
  name: v.string(),
  email: v.string(),

  // Eski alan — artık kullanılmıyor ama schema'da tutulacak
  oldUsername: deprecated,        // v.optional(v.any()) ile aynı
  legacyId: deprecated,
};
```

---

## validate — Runtime Validation

Custom validator logic için:

```typescript
import { validate } from "convex-helpers/validators";

// Herhangi bir değeri validator'a göre kontrol et
const result = validate(v.string(), someValue);
// throws if invalid
```

---

## tableHelper & withSystemFields

Schema tanımını daha temiz tut:

```typescript
import { tableHelper, withSystemFields, systemFields } from "convex-helpers/validators";

// Tablo field'larını ayrı tanımla
const userFields = {
  name: v.string(),
  email: v.string(),
  role: literals("admin", "user"),
};

// Schema'da kullan
export default defineSchema({
  users: defineTable(userFields).index("by_email", ["email"]),
});

// Validator olarak kullan (functions'da)
export const createUser = mutation({
  args: userFields,              // _id, _creationTime olmadan
  handler: async (ctx, args) => ctx.db.insert("users", args),
});

export const readUser = query({
  args: { id: v.id("users") },
  returns: v.object(withSystemFields("users", userFields)), // _id, _creationTime dahil
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// System fields ayrı ihtiyaç olursa
const { _id, _creationTime } = systemFields("users");
```

---

## Tam Şema Örneği — Validator Utilities ile

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { literals, deprecated } from "convex-helpers/validators";

// Paylaşılan field tanımları
export const userFields = {
  name: v.string(),
  email: v.string(),
  role: literals("admin", "user", "moderator"),
  bio: v.optional(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
  // Migration sırasında deprecated
  oldAvatarUrl: deprecated,
};

export const postFields = {
  title: v.string(),
  body: v.string(),
  authorId: v.id("users"),
  status: literals("draft", "published", "archived"),
  tags: v.array(v.string()),
  publishedAt: v.optional(v.number()),
};

export default defineSchema({
  users: defineTable(userFields)
    .index("by_email", ["email"])
    .index("by_role", ["role"]),
  posts: defineTable(postFields)
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_author_status", ["authorId", "status"]),
});

// convex/functions/users.ts
import { userFields } from "../schema";
import { partial } from "convex-helpers/validators";

export const createUser = mutation({
  args: userFields,  // Schema field'ları direkt kullan
  handler: async (ctx, args) => ctx.db.insert("users", args),
});

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    patch: v.object(partial(userFields)),  // Hepsi optional
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch("users", id, patch);
  },
});
```
