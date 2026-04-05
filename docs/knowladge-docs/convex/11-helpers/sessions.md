# Session Tracking (Auth Gerektirmeden)

Kaynak: convex-helpers/react/sessions

## Nedir?

Kullanıcıyı **giriş yapmadan** tanımak için client-side session ID'si. Anonymous kullanıcılar için shopping cart, draft, preferences gibi özellikler için idealdir.

**Auth'tan farkı:** Session ID tarayıcıda localStorage'da saklanır. Farklı tarayıcıda veya incognito'da kaybolur.

---

## İki Yaklaşım

| Yaklaşım | Depolama | Kullanım |
|----------|---------|---------|
| **Client-side** | localStorage | Basit, auth gerekmez |
| **Server-persisted** | Convex DB | Daha güvenilir |

---

## Client-Side Sessions

```bash
pnpm add convex-helpers
```

### Provider Kurulumu

```typescript
// app/root.tsx (TanStack Start)
import { SessionProvider } from "convex-helpers/react/sessions";

function RootComponent() {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <SessionProvider>
          <Outlet />
        </SessionProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Client'ta Kullanım

```typescript
import {
  useSessionQuery,
  useSessionMutation,
} from "convex-helpers/react/sessions";

// Session ID otomatik geçer — elle yazmak gerekmez
function Cart() {
  const cart = useSessionQuery(api.cart.getItems);
  const addItem = useSessionMutation(api.cart.addItem);

  return (
    <div>
      {cart?.map((item) => <CartItem key={item._id} item={item} />)}
      <button onClick={() => addItem({ productId: "abc" })}>Add</button>
    </div>
  );
}
```

---

## Server Tarafı

```typescript
// convex/lib/functions.ts
import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

// sessionId argümanını consume et, ctx.sessionId olarak sun
export const sessionQuery = customQuery(query, {
  args: { sessionId: v.id("sessions") },
  input: async (ctx, { sessionId }) => ({
    ctx: { ...ctx, sessionId },
    args: {},
  }),
});

export const sessionMutation = customMutation(mutation, {
  args: { sessionId: v.id("sessions") },
  input: async (ctx, { sessionId }) => ({
    ctx: { ...ctx, sessionId },
    args: {},
  }),
});
```

### Fonksiyonlarda Kullanım

```typescript
// convex/functions/cart.ts
import { sessionQuery, sessionMutation } from "../lib/functions";
import { v } from "convex/values";

export const getItems = sessionQuery({
  args: {},
  handler: async (ctx) => {
    // ctx.sessionId otomatik mevcut
    return ctx.db
      .query("cartItems")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .collect();
  },
});

export const addItem = sessionMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    return ctx.db.insert("cartItems", {
      sessionId: ctx.sessionId,
      productId,
      quantity: 1,
      addedAt: Date.now(),
    });
  },
});
```

---

## Schema

```typescript
// schema.ts
sessions: defineTable({
  // Client-generated ID için metadata
  createdAt: v.number(),
  lastSeenAt: v.number(),
}).index("by_createdAt", ["createdAt"]),

cartItems: defineTable({
  sessionId: v.id("sessions"),
  productId: v.id("products"),
  quantity: v.number(),
  addedAt: v.number(),
}).index("by_session", ["sessionId"]),
```

---

## Session → User Merge (Giriş Sonrası)

```typescript
// Kullanıcı giriş yaptığında session'ı hesabına merge et
export const mergeSessionToUser = sessionMutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    // Session'daki cart'ı kullanıcıya taşı
    const sessionItems = await ctx.db
      .query("cartItems")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .collect();

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) return;

    // Her session item'ı user item'a dönüştür
    await Promise.all(
      sessionItems.map(async (item) => {
        // Varsa güncelle, yoksa ekle
        const existing = await ctx.db
          .query("cartItems")
          .withIndex("by_user_product", (q) =>
            q.eq("userId", user._id).eq("productId", item.productId)
          )
          .unique();

        if (existing) {
          await ctx.db.patch("cartItems", existing._id, {
            quantity: existing.quantity + item.quantity,
          });
        } else {
          await ctx.db.insert("cartItems", {
            userId: user._id,
            productId: item.productId,
            quantity: item.quantity,
            addedAt: item.addedAt,
          });
        }

        // Session item'ı sil
        await ctx.db.delete("cartItems", item._id);
      })
    );
  },
});
```
