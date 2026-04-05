# Convex Schema Tanımı

Kaynak: https://docs.convex.dev/database/schemas

## Nedir?

Schema, projedeki tabloları ve döküman tiplerini tanımlar. **Opsiyonel** ama hem runtime validation hem TypeScript type safety sağlar.

## Temel Yapı

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user"), v.literal("moderator")),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    tags: v.array(v.string()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_author_status", ["authorId", "status"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status"],
    }),

  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    body: v.string(),
    parentId: v.optional(v.id("comments")), // nested comments
  })
    .index("by_post", ["postId"])
    .index("by_author", ["authorId"]),
});
```

## Sistem Alanları (Otomatik)

Her döküman Convex tarafından otomatik alır:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `_id` | `Id<"tableName">` | Unique identifier |
| `_creationTime` | `number` | Unix timestamp (ms) |

## Schema Options

```typescript
export default defineSchema(
  {
    users: defineTable({ ... }),
  },
  {
    schemaValidation: true,    // Runtime validation (default: true)
    strictTableNameTypes: true, // TypeScript strict mode (default: true)
  }
);
```

- **schemaValidation: false** → TypeScript tipleri kalır, runtime check devre dışı (prototyping için)
- **strictTableNameTypes: false** → Tanımsız tablolara erişime izin ver (geçiş döneminde)

## TypeScript Tipleri

Schema'dan otomatik tip üretimi:

```typescript
import { Doc, Id } from "./_generated/dataModel";

type User = Doc<"users">;
// {
//   _id: Id<"users">;
//   _creationTime: number;
//   name: string;
//   email: string;
//   role: "admin" | "user" | "moderator";
//   bio?: string;
//   ...
// }

type UserId = Id<"users">;
```

## İlişki Modelleme

### One-to-Many

```typescript
// Bir user'ın birçok post'u var
posts: defineTable({
  authorId: v.id("users"), // FK
  ...
}).index("by_author", ["authorId"]),
```

### Many-to-Many (Join Table)

```typescript
// User'lar çok tag'e sahip, tag'ler çok user'a
userTags: defineTable({
  userId: v.id("users"),
  tagId: v.id("tags"),
})
  .index("by_user", ["userId"])
  .index("by_tag", ["tagId"])
  .index("by_user_tag", ["userId", "tagId"]), // unique constraint için
```

### Self-Reference (Tree Structure)

```typescript
categories: defineTable({
  name: v.string(),
  parentId: v.optional(v.id("categories")), // null = root
}).index("by_parent", ["parentId"]),
```

## Deployment

Schema değişikliği `npx convex dev` veya `npx convex deploy` ile deploy edilir.

**İlk push:** Mevcut tüm dökümanlar schema'ya uyumlu mu kontrol eder. Uyumsuzluk varsa deploy başarısız.

**Sonraki push'lar:** Yeni insert/update otomatik validate edilir.

## Migration Pattern

Alan ekleme (safe):
```typescript
// 1. Adım: Optional yap
bio: v.optional(v.string()),

// 2. Adım: Migration mutation çalıştır
// 3. Adım: Required yap
bio: v.string(),
```
