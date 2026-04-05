# Gelişmiş Pagination — getPage & QueryStreams

Kaynak: https://stack.convex.dev/pagination

## Built-in Pagination Limitleri

`usePaginatedQuery` ve `.paginate()` şunları **desteklemez:**
- Joins (paginated contacts + their emails)
- Union (birden fazla tablodan birleşik liste)
- Virtual scrolling (belirli bir konuma atla)
- Memory management (görünmez sayfaları unload et)
- Rapid insertion sırasında page size kontrolü

---

## getPage — Manuel Pagination

```typescript
import { getPage } from "convex-helpers/server/pagination";
```

### Temel Kullanım

```typescript
export const listPosts = query({
  args: {
    startCursor: v.optional(v.string()),
    endCursor: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, { startCursor, endCursor, order }) => {
    const { page, indexKeys, hasMore } = await getPage(ctx.db, {
      table: "posts",
      index: "by_createdAt",
      startIndexKey: startCursor ? JSON.parse(startCursor) : undefined,
      endIndexKey: endCursor ? JSON.parse(endCursor) : undefined,
      order: order ?? "desc",
      targetMaxRows: 20,    // Soft limit
      absoluteMaxRows: 50,  // Hard limit
    });

    return {
      posts: page,
      // Son item'ın index key'i — sonraki sayfa için cursor
      nextCursor: hasMore
        ? JSON.stringify(indexKeys[indexKeys.length - 1])
        : null,
      hasMore,
    };
  },
});
```

### Index Keys

Index key'ler index içindeki bir konumu belirtir. `by_name` index'i için:
```
["Smith", "John", 1719412234000, "document-id"]
// [surname, givenName, _creationTime, _id]
```

---

## Join Query ile Pagination

```typescript
export const contactsWithEmails = query({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { cursor }) => {
    // 1. Paginated contacts
    const { page: contacts, indexKeys, hasMore } = await getPage(ctx.db, {
      table: "contacts",
      index: "by_name",
      startIndexKey: cursor ? JSON.parse(cursor) : undefined,
      targetMaxRows: 10,
    });

    // 2. Her contact için emails
    const contactsWithEmails = await Promise.all(
      contacts.map(async (contact) => {
        const { page: emails } = await getPage(ctx.db, {
          table: "emails",
          index: "by_contactId",
          // startIndexKey ve endIndexKey ile sadece bu contact'ın emailleri
          startIndexKey: [contact._id],
          endIndexKey: [contact._id, Infinity],
          targetMaxRows: 5,
        });

        return { ...contact, emails };
      })
    );

    return {
      contacts: contactsWithEmails,
      nextCursor: hasMore
        ? JSON.stringify(indexKeys[indexKeys.length - 1])
        : null,
    };
  },
});
```

---

## Bidirectional Scrolling

```typescript
export const scrollableList = query({
  args: {
    anchor: v.optional(v.string()),   // Atlayacağımız konum
    direction: v.union(v.literal("before"), v.literal("after")),
    limit: v.number(),
  },
  handler: async (ctx, { anchor, direction, limit }) => {
    const anchorKey = anchor ? JSON.parse(anchor) : undefined;

    const { page, indexKeys, hasMore } = await getPage(ctx.db, {
      table: "messages",
      index: "by_createdAt",
      startIndexKey: direction === "after" ? anchorKey : undefined,
      endIndexKey: direction === "before" ? anchorKey : undefined,
      order: direction === "before" ? "desc" : "asc",
      startInclusive: false,
      targetMaxRows: limit,
    });

    return {
      messages: direction === "before" ? page.reverse() : page,
      hasMore,
    };
  },
});
```

---

## QueryStreams — Composable Streams

Birden fazla tabloyu birleştirmek, filtre uygulamak için:

```typescript
import {
  mergeOrderedStreams,
  queryStream,
} from "convex-helpers/server/pagination";
```

### Union — Birden Fazla Tablodan Birleştir

```typescript
export const activityFeed = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId, paginationOpts }) => {
    // Farklı tablolardan etkinlikler
    const postStream = queryStream(ctx.db, {
      table: "posts",
      index: "by_author",
      startIndexKey: [userId],
      endIndexKey: [userId, Infinity],
      order: "desc",
    });

    const commentStream = queryStream(ctx.db, {
      table: "comments",
      index: "by_author",
      startIndexKey: [userId],
      endIndexKey: [userId, Infinity],
      order: "desc",
    });

    const likeStream = queryStream(ctx.db, {
      table: "likes",
      index: "by_user",
      startIndexKey: [userId],
      endIndexKey: [userId, Infinity],
      order: "desc",
    });

    // Tüm stream'leri _creationTime'a göre birleştir
    const merged = mergeOrderedStreams(
      [postStream, commentStream, likeStream],
      "desc"
    );

    // Paginate
    return merged.paginate(paginationOpts);
  },
});
```

### filterWith — Async Filter

```typescript
export const filteredMessages = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const stream = queryStream(ctx.db, {
      table: "messages",
      index: "by_createdAt",
      order: "desc",
    });

    // Async filter — her doc için ayrı query yapılabilir
    const filtered = stream.filterWith(async (msg) => {
      const author = await ctx.db.get(msg.authorId);
      return !author?.isBanned; // Banned kullanıcıların mesajlarını gizle
    });

    return filtered.paginate(paginationOpts);
  },
});
```

### map + flatMap

```typescript
const enrichedStream = stream
  .map(async (post) => ({
    ...post,
    author: await ctx.db.get(post.authorId),
  }))
  .filterWith(async (post) => post.author !== null);
```

---

## paginator — Mutation'da Pagination

`usePaginatedQuery` yalnızca query'de çalışır. Mutation'da tablo iterate etmek için `Paginator`:

```typescript
import { Paginator } from "convex-helpers/server/pagination";

export const bulkUpdatePosts = internalMutation({
  args: { newStatus: v.string() },
  handler: async (ctx, { newStatus }) => {
    const paginator = new Paginator(ctx.db, {
      table: "posts",
      index: "by_status",
      startIndexKey: ["draft"],
      endIndexKey: ["draft", Infinity],
    });

    let count = 0;
    // Her çağrıda 100 kayıt işle
    for await (const post of paginator.take(100)) {
      await ctx.db.patch("posts", post._id, { status: newStatus });
      count++;
    }

    return { updated: count, hasMore: !paginator.isDone };
  },
});
```
