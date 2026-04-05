# Zod ile Convex Validation

Kaynak: https://stack.convex.dev/typescript-zod-function-validation

## Neden Zod?

- **Runtime type safety** — TypeScript tek basina yeterli degil
- **DRY** — Tekrar eden type + validator tanımi yok
- **Gelismis validasyon** — email, url, min/max, transform
- **ConvexError entegrasyonu** — Hata detayli `ZodError` iceriyor

## Kurulum

```bash
pnpm add zod convex-helpers
```

## zCustomQuery / zCustomMutation

```typescript
// convex/lib/functions.ts
import {
  zCustomQuery,
  zCustomMutation,
} from "convex-helpers/server/zod";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "../model/users";

export const zQuery = zCustomQuery(query, {
  args: {},
  input: async (ctx, args) => ({ ctx, args: {} }),
});

export const zMutation = zCustomMutation(mutation, {
  args: {},
  input: async (ctx, args) => ({ ctx, args: {} }),
});

export const zAuthMutation = zCustomMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    return { ctx: { ...ctx, user }, args: {} };
  },
});
```

## Zod Validators ile Fonksiyon

```typescript
import { z } from "zod";
import { zid } from "convex-helpers/server/zod";
import { zAuthMutation } from "../lib/functions";

export const createPost = zAuthMutation({
  args: {
    title: z.string().min(3).max(100),
    body: z.string().min(10).max(10000),
    tags: z.array(z.string()).max(10).optional(),
    status: z.enum(["draft", "published"]).default("draft"),
  },
  handler: async (ctx, { title, body, tags, status }) => {
    return ctx.db.insert("posts", {
      title,
      body,
      tags: tags ?? [],
      status,
      authorId: ctx.user._id,
    });
  },
});
```

## zid — Convex Document ID Dogrulama

```typescript
import { zid } from "convex-helpers/server/zod";

export const getPost = zQuery({
  args: {
    postId: zid("posts"),  // Id<"posts"> — table-specific
  },
  handler: async (ctx, { postId }) => {
    return ctx.db.get(postId);
  },
});
```

## Output Validation (Data Leakage Onleme)

```typescript
import { z } from "zod";

const publicUserSchema = z.object({
  _id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  // NOT: email, role, vs — gizli alanlar cikartildi
});

export const getPublicProfile = zQuery({
  args: { userId: zid("users") },
  returns: publicUserSchema.nullable(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    // Zod transform ile sadece izin verilen alanlar
    return publicUserSchema.parse(user);
  },
});
```

## Gelismis Validasyon

```typescript
const createUserArgs = z.object({
  email: z.string().email("Gecersiz email formati"),
  username: z.string()
    .min(3, "En az 3 karakter")
    .max(20, "En fazla 20 karakter")
    .regex(/^[a-z0-9_]+$/, "Kucuk harf, rakam ve alt cizgi"),
  birthYear: z.number().min(1900).max(new Date().getFullYear()),
  website: z.string().url().optional(),
});

export const createUser = zAuthMutation({
  args: createUserArgs.shape,
  handler: async (ctx, args) => {
    // args.email → dogrulandi, type-safe
    // args.username → dogrulandi, type-safe
  },
});
```

## Error Handling

Zod validasyon hatasi ConvexError olarak client'a gider:

```typescript
// Client'ta yakalama
try {
  await createPost({ title: "ab", body: "kisa" });
} catch (error) {
  if (error instanceof ConvexError) {
    // error.data ZodError iceriyor
    const zodError = error.data;
    console.log(zodError.errors);
    // [{ path: ["title"], message: "En az 3 karakter" }]
  }
}
```

## Tip Uretimi

```typescript
import { z } from "zod";

const postSchema = z.object({
  title: z.string(),
  body: z.string(),
  status: z.enum(["draft", "published"]),
});

// Schema'dan tip uret — tek kaynak
type Post = z.infer<typeof postSchema>;
// { title: string; body: string; status: "draft" | "published" }
```
