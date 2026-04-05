# Convex Queries

Kaynak: https://docs.convex.dev/functions/query

## Nedir?

Query'ler veritabanından veri okuyan, **cache'lenen** ve **real-time subscribe** edilebilen fonksiyonlardır. External API çağrısı yapamazlar.

## Temel Yapı

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tasks"),
      title: v.string(),
      completed: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});
```

## Context (ctx) Nesnesi

`QueryCtx` içerdiği alanlar:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `ctx.db` | `DatabaseReader` | Veritabanı okuma API'si |
| `ctx.auth` | `Auth` | Auth token bilgisi |
| `ctx.storage` | `StorageReader` | File storage okuma |

## Argument Validation

```typescript
export const searchUsers = query({
  args: {
    name: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { name, role, limit }) => {
    // args tamamen type-safe
  },
});
```

## Return Value Validation

```typescript
export const getUser = query({
  args: { id: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});
```

## Client'ta Kullanım

```typescript
// React
import { useQuery } from "convex/react";

function Component() {
  const task = useQuery(api.tasks.getTask, { taskId: "abc123" });
  
  if (task === undefined) return <Loading />;  // loading
  if (task === null) return <NotFound />;       // not found
  return <div>{task.title}</div>;
}

// TanStack Start / React Query
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

const { data } = useSuspenseQuery(convexQuery(api.tasks.getTask, { taskId }));
```

## Önemli Kurallar

1. **Query deterministiktir** — Aynı argümanlar her zaman aynı sonucu verir
2. **Date.now() kullanma** — Cache'i bozar, stale sonuçlar
3. **External API çağrısı yasak** — Sadece veritabanı okuma
4. **Retry gereksiz** — Deterministic olduğu için retry değişiklik yaratmaz

## Query vs Internal Query

```typescript
// Public — client çağırabilir
export const getPublicPosts = query({ ... });

// Internal — sadece diğer Convex fonksiyonları çağırabilir
export const getPrivatePosts = internalQuery({ ... });
```
