# Convex Argument & Return Value Validation

Kaynak: https://docs.convex.dev/functions/validation

## Neden Önemli?

TypeScript tipleri **runtime'da mevcut değildir**. Validation olmadan malicious client her değeri gönderebilir. `v` validators hem TypeScript tiplerini hem de runtime kontrollerini sağlar.

## Tüm Validator Tipleri

### Primitive Tipler

```typescript
import { v } from "convex/values";

v.string()    // UTF-8 string, max 1MB
v.number()    // IEEE-754 floating point
v.int64()     // BigInt, -2^63 ile 2^63-1 arası
v.boolean()   // true/false
v.null()      // null
v.bytes()     // ArrayBuffer, max 1MB
v.id("tableName") // Convex document ID
```

### Collection Tipleri

```typescript
v.array(v.string())          // max 8,192 element
v.object({                   // max 1,024 property, unknown property reject
  name: v.string(),
  age: v.number(),
})
v.record(v.string(), v.boolean()) // dynamic key-value
```

### Modifier Tipleri

```typescript
v.optional(v.string())             // string | undefined
v.nullable(v.string())             // string | null (union shorthand)
v.union(v.string(), v.number())    // string | number
v.literal("admin")                 // sadece "admin" değeri
v.literal(42)                      // sadece 42 değeri
v.any()                            // herhangi bir değer (kaçın!)
```

## Object Validator Methods

Validators compose edilebilir — DRY ilkesi için:

```typescript
const userValidator = v.object({
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("user")),
  bio: v.optional(v.string()),
  status: v.literal("active"),
});

// Sadece belirli alanları al
const publicUser = userValidator.pick("name", "email");

// Belirli alanları çıkar
const userWithoutStatus = userValidator.omit("status");

// Tüm alanları optional yap (patch için ideal)
const userPatch = userValidator.partial();

// Yeni alanlar ekle
const userDocument = userValidator.extend({
  _id: v.id("users"),
  _creationTime: v.number(),
});
```

## TypeScript Type Inference

```typescript
import { Infer } from "convex/values";

const postValidator = v.object({
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  published: v.boolean(),
});

// Validator'dan tip üret — duplicate type tanımı gereksiz
type Post = Infer<typeof postValidator>;
// { title: string; body: string; tags: string[]; published: boolean }
```

## Tam Fonksiyon Örneği

```typescript
export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
  },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    // args.title → string (type-safe)
    // args.tags → string[] | undefined (type-safe)
    // args.status → "draft" | "published" | "archived" (type-safe)
    return ctx.db.insert("posts", {
      ...args,
      tags: args.tags ?? [],
      authorId: "...",
    });
  },
});
```

## Schema ile Uyum

Schema validator'ları ile function validator'ları aynı `v` API'sini kullanır:

```typescript
// schema.ts
const posts = defineTable({
  title: v.string(),
  body: v.string(),
  authorId: v.id("users"),
});

// functions/posts.ts — schema ile tutarlı
export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    // authorId schema'dan geliyor, client sağlamaz
  },
  handler: async (ctx, { title, body }) => {
    const identity = await ctx.auth.getUserIdentity();
    return ctx.db.insert("posts", {
      title,
      body,
      authorId: identity!.subject,
    });
  },
});
```

## Shared Validators (DRY Pattern)

```typescript
// lib/validators.ts — paylaşılan validator'lar
export const paginationValidator = v.object({
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
});

export const idValidator = (table: string) => v.object({
  id: v.id(table),
});

// Kullanım
export const getPosts = query({
  args: {
    ...paginationValidator.fields,
    authorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => { ... },
});
```
