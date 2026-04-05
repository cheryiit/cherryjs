# Convex Mutations

Kaynak: https://docs.convex.dev/functions/mutation

## Nedir?

Mutation'lar veritabanına **yazma** yapan, **transactional atomicity** garantisi olan fonksiyonlardır. External API çağrısı yapamazlar.

## Temel Yapı

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: {
    title: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      priority: args.priority,
      authorId: identity.subject,
      completed: false,
    });
    
    return taskId;
  },
});
```

## Context (ctx) Nesnesi

`MutationCtx` içerdiği alanlar:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `ctx.db` | `DatabaseWriter` | Veritabanı okuma + yazma API'si |
| `ctx.auth` | `Auth` | Auth token bilgisi |
| `ctx.storage` | `StorageWriter` | File storage |
| `ctx.scheduler` | `Scheduler` | Function scheduling |

## Transactional Behavior

```typescript
export const transferPoints = mutation({
  args: {
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, { fromUserId, toUserId, amount }) => {
    const fromUser = await ctx.db.get(fromUserId);
    const toUser = await ctx.db.get(toUserId);
    
    if (!fromUser || fromUser.points < amount) {
      throw new ConvexError({ code: "INSUFFICIENT_POINTS" });
    }
    
    // Her iki yazma da atomik — ikisi birden ya commit ya rollback
    await ctx.db.patch("users", fromUserId, { points: fromUser.points - amount });
    await ctx.db.patch("users", toUserId, { points: toUser.points + amount });
  },
});
```

## Scheduling ile Kullanım

```typescript
export const processOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    // Mutation başarılı olursa scheduling de garantili
    await ctx.db.patch("orders", orderId, { status: "processing" });
    
    // Internal action schedule et
    await ctx.scheduler.runAfter(
      0,
      internal.payments.processPayment,
      { orderId }
    );
  },
});
```

## Client'ta Kullanım

```typescript
// React
import { useMutation } from "convex/react";

function Component() {
  const createTask = useMutation(api.tasks.createTask);
  
  const handleSubmit = async () => {
    try {
      const taskId = await createTask({ title: "New Task", priority: "medium" });
    } catch (error) {
      if (error instanceof ConvexError) {
        console.error(error.data); // typed error data
      }
    }
  };
}
```

## Optimistic Updates

```typescript
// Client'ta optimistic update
const createTask = useMutation(api.tasks.createTask).withOptimisticUpdate(
  (localStore, args) => {
    const tasks = localStore.getQuery(api.tasks.list, {});
    if (tasks !== undefined) {
      const newTask = {
        _id: "temp_" + Date.now() as Id<"tasks">,
        _creationTime: Date.now(),
        title: args.title,
        completed: false,
      };
      localStore.setQuery(api.tasks.list, {}, [...tasks, newTask]);
    }
  }
);
```

## Mutation vs Internal Mutation

```typescript
// Public — client çağırabilir, auth check zorunlu
export const updateTask = mutation({
  args: { taskId: v.id("tasks"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    // ownership check...
    await ctx.db.patch("tasks", args.taskId, { title: args.title });
  },
});

// Internal — sadece diğer Convex fonksiyonlarından
export const systemUpdateTask = internalMutation({
  args: { taskId: v.id("tasks"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch("tasks", args.taskId, { status: args.status });
  },
});
```
