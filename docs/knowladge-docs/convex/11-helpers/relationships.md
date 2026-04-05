# Relationship Helpers

Kaynak: https://stack.convex.dev/functional-relationships-helpers
GitHub: https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/relationships.ts

## Neden?

Convex'te SQL JOIN yok. Relationship helper'lar N+1 pattern'ini **temiz, type-safe** şekilde halleder.

> `db.get` ~1ms — N+1 Convex'te gerçek bir sorun değildir.

---

## Exported API

```typescript
import {
  getOrThrow,           // ID ile getir, null ise throw
  getAll,               // Birden fazla ID ile getir → (T | null)[]
  getAllOrThrow,         // Birden fazla ID ile getir → T[] (null ise throw)
  getOneFrom,           // Index'ten tek doc getir → T | null
  getOneFromOrThrow,    // Index'ten tek doc getir, null ise throw
  getManyFrom,          // Index'ten çok doc getir → T[]
  getManyVia,           // Join table üzerinden → T[]
  getManyViaOrThrow,    // Join table üzerinden, null ise throw
} from "convex-helpers/server/relationships";
```

---

## Index Naming Convention

Helper'lar index adından field adını otomatik çıkarır:

```typescript
// "by_" prefix'i kaldırır → field adı
.index("by_authorId", ["authorId"])
//         ↓
getManyFrom(db, "posts", "by_authorId", userId);
// Explicit field adi belirtmek gereksiz
```

---

## getOrThrow — ID ile, Null ise Throw

```typescript
import { getOrThrow } from "convex-helpers/server/relationships";

// Null ise error fırlatır
const user = await getOrThrow(ctx.db, userId);
// User — garantili
```

---

## getAll & getAllOrThrow — Toplu Fetch

```typescript
import { getAll, getAllOrThrow } from "convex-helpers/server/relationships";

// Birden fazla ID
const postIds: Id<"posts">[] = ["id1", "id2", "id3"];

// Null içerebilir
const posts = await getAll(ctx.db, "posts", postIds);
// (Post | null)[] — sıralama postIds ile aynı

// Null ise hata
const requiredPosts = await getAllOrThrow(ctx.db, "posts", postIds);
// Post[]
```

---

## getOneFrom — One-to-One (Back Reference)

```typescript
import { getOneFrom, getOneFromOrThrow } from "convex-helpers/server/relationships";

// Bir user'ın profilini getir
const profile = await getOneFrom(
  ctx.db,
  "profiles",      // aranacak tablo
  "by_userId",     // index adı
  userId,          // aranan değer
  "userId"         // field adı (opsiyonel — index'ten çıkarılır)
);
// Profile | null

// Null ise throw
const profile = await getOneFromOrThrow(ctx.db, "profiles", "by_userId", userId);
// Profile
```

---

## getManyFrom — One-to-Many

```typescript
import { getManyFrom } from "convex-helpers/server/relationships";

// Bir user'ın tüm post'ları
const posts = await getManyFrom(
  ctx.db,
  "posts",         // aranacak tablo
  "by_authorId",   // index adı
  userId,          // aranan değer
  "authorId"       // field adı (opsiyonel)
);
// Post[]

// Order belirtmek istersen — rawQuery ile
const orderedPosts = await ctx.db
  .query("posts")
  .withIndex("by_authorId", (q) => q.eq("authorId", userId))
  .order("desc")
  .collect();
```

---

## getManyVia — Many-to-Many (Join Table)

```typescript
import { getManyVia, getManyViaOrThrow } from "convex-helpers/server/relationships";

// User → UserTags → Tags
const tags = await getManyVia(
  ctx.db,
  "userTags",      // join table
  "tagId",         // hedef field
  "by_userId",     // join table index
  userId,          // user id
  "tags"           // hedef tablo
);
// Tag[] (null olanlar atlanır)

// Null olanlar hata fırlatsın
const requiredTags = await getManyViaOrThrow(
  ctx.db,
  "userTags",
  "tagId",
  "by_userId",
  userId,
  "tags"
);
```

---

## Gerçek Dünya Örneği

```typescript
// convex/model/posts.ts
import {
  getOneFrom,
  getManyFrom,
  getManyVia,
  getAll,
} from "convex-helpers/server/relationships";

export async function getPostWithFullDetails(
  ctx: QueryCtx,
  postId: Id<"posts">
) {
  const post = await ctx.db.get(postId);
  if (!post) return null;

  const [author, comments, tags, attachments] = await Promise.all([
    // Author — direct ID
    ctx.db.get(post.authorId),

    // Comments — one-to-many
    getManyFrom(ctx.db, "comments", "by_postId", postId),

    // Tags — many-to-many via postTags
    getManyVia(ctx.db, "postTags", "tagId", "by_postId", postId, "tags"),

    // Attachments — one-to-many
    getManyFrom(ctx.db, "attachments", "by_postId", postId),
  ]);

  // Comment author'larını paralel fetch
  const commentAuthorIds = comments.map((c) => c.authorId);
  const commentAuthors = await getAll(ctx.db, "users", commentAuthorIds);

  return {
    ...post,
    author,
    tags,
    attachments,
    comments: comments.map((comment, i) => ({
      ...comment,
      author: commentAuthors[i],
    })),
  };
}
```

---

## Schema — Relationship'ler için

```typescript
// schema.ts
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }).index("by_email", ["email"]),

  // One profile per user
  profiles: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()),
    website: v.optional(v.string()),
  }).index("by_userId", ["userId"]),  // getOneFrom için

  // User'ın postları
  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
    status: v.string(),
  }).index("by_authorId", ["authorId"]),  // getManyFrom için

  // Tags
  tags: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  // Many-to-many: Post ↔ Tag
  postTags: defineTable({
    postId: v.id("posts"),
    tagId: v.id("tags"),
  })
    .index("by_postId", ["postId"])          // getManyVia için
    .index("by_tagId", ["tagId"])
    .index("by_postId_tagId", ["postId", "tagId"]),  // unique constraint

  // Comments
  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    body: v.string(),
    parentId: v.optional(v.id("comments")),  // nested comments
  })
    .index("by_postId", ["postId"])           // getManyFrom için
    .index("by_authorId", ["authorId"]),
});
```

---

## Type Safety

Helper'lar TypeScript generics ile tam tip güvenliği sağlar:

```typescript
// getOneFrom dönüş tipi otomatik çıkarılır
const profile = await getOneFrom(ctx.db, "profiles", "by_userId", userId);
//    ↑ Profile | null — tip anotasyonu gerekmez

// getManyFrom
const posts = await getManyFrom(ctx.db, "posts", "by_authorId", userId);
//    ↑ Post[] — tam type-safe

// Yanlış tablo/index → Compile error
await getOneFrom(ctx.db, "posts", "by_userId", userId);
// ❌ TypeScript Error: "by_userId" is not an index of "posts"
```
