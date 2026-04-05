# CRUD Utilities

Kaynak: https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/crud.ts

## Nedir?

`crud()` fonksiyonu bir tablo için standart **create/read/update/delete/paginate** operasyonlarını otomatik üretir.

> "Recommended for prototyping or internal functions unless row-level security is added."

---

## Exported API

```typescript
import { crud } from "convex-helpers/server/crud";
```

Döndürdüğü 5 metot:

| Metot | İşlem | Dönüş |
|-------|-------|-------|
| `create` | Insert + fetch | `Doc<T>` |
| `read` | ID ile getir | `Doc<T> \| null` |
| `update` | Patch (kısmi güncelleme) | `Doc<T>` |
| `destroy` | Delete | `Doc<T>` (silinen) |
| `paginate` | Cursor-based liste | `PaginationResult<Doc<T>>` |

---

## Temel Kullanım

```typescript
// convex/functions/posts.ts
import { crud } from "convex-helpers/server/crud";
import schema from "../schema";
import { mutation, query } from "../_generated/server";

// Tüm CRUD otomatik oluşur
export const {
  create,
  read,
  update,
  destroy,
  paginate,
} = crud(schema, "posts");
```

Bu kadar. `posts` tablosu için 5 fonksiyon hazır.

---

## Internal CRUD (Daha Güvenli)

Public API'den gizlemek için internal builders kullan:

```typescript
import { crud } from "convex-helpers/server/crud";
import { internalQuery, internalMutation } from "../_generated/server";
import schema from "../schema";

// Tüm operasyonlar internal — client'tan çağrılamaz
export const {
  create: internalCreate,
  read: internalRead,
  update: internalUpdate,
  destroy: internalDestroy,
  paginate: internalPaginate,
} = crud(schema, "users", internalQuery, internalMutation);
```

---

## Custom Function Builder ile Birlikte

```typescript
import { crud } from "convex-helpers/server/crud";
import { authenticatedMutation, authenticatedQuery } from "../lib/functions";
import schema from "../schema";

// Auth gerektirir
export const {
  create,
  read,
  update,
  destroy,
  paginate,
} = crud(schema, "tasks", authenticatedQuery, authenticatedMutation);
```

---

## Client'tan Kullanım

```typescript
// React
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Create
const createPost = useMutation(api.posts.create);
await createPost({
  title: "Hello",
  body: "World",
  status: "draft",
});

// Read
const post = useQuery(api.posts.read, { id: postId });

// Update
const updatePost = useMutation(api.posts.update);
await updatePost({
  id: postId,
  patch: { title: "Updated Title" }, // sadece değişen alanlar
});

// Delete
const destroyPost = useMutation(api.posts.destroy);
await destroyPost({ id: postId });

// Paginate
const { results, loadMore, status } = usePaginatedQuery(
  api.posts.paginate,
  {},
  { initialNumItems: 20 }
);
```

---

## Sistem Alanları Otomatik Handle

`create` fonksiyonu `_id` ve `_creationTime` alanlarını otomatik optional yapar:

```typescript
// Schema'da zorunlu olsa da create'de geçmek gerekmez
await createPost({
  title: "Hello",
  body: "World",
  // _id → otomatik oluşturulur
  // _creationTime → otomatik oluşturulur
});
```

---

## Ne Zaman Kullanma

```typescript
// ✅ CRUD ile — internal functions veya prototyping
export const { create, read } = crud(schema, "logs", internalQuery, internalMutation);

// ❌ CRUD kullanma — public API, custom business logic, RLS gerekiyorsa
// Bunlar için manuel mutation yaz:
export const createPost = authenticatedMutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    // Auth check, validation, ownership — hepsi custom
    return ctx.db.insert("posts", { title, authorId: ctx.user._id });
  },
});
```

**Tavsiye:** CRUD'u sadece admin paneli, internal tooling veya hızlı prototyping için kullan. Production public API'lerde explicit fonksiyonlar yaz.
