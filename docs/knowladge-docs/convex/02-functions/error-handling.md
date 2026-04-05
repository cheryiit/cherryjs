# Convex Error Handling

Kaynak: https://docs.convex.dev/functions/error-handling

## Hata Tipleri

| Tip | Açıklama | Retry? |
|-----|----------|--------|
| **Application Error** | `ConvexError` ile throw — beklenen hata | Hayır |
| **Developer Error** | Kod hatası (null deref, type error) | Hayır |
| **Read/Write Limit** | Fazla veri okuma/yazma | Hayır |
| **Internal Convex** | Altyapı sorunu | Evet (otomatik) |

## ConvexError — Typed Application Errors

```typescript
import { ConvexError } from "convex/values";

// String error
throw new ConvexError("Unauthenticated");

// Typed error data
throw new ConvexError({
  code: "INSUFFICIENT_PERMISSIONS",
  requiredRole: "admin",
  currentRole: "user",
});

// Error enum ile (önerilen)
throw new ConvexError({ code: ErrorCodes.NOT_FOUND, resource: "user" });
```

## Error Codes Enum (Framework Standardı)

```typescript
// lib/errors.ts
export const ErrorCodes = {
  // Auth
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  
  // Resource
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  
  // Validation
  INVALID_INPUT: "INVALID_INPUT",
  
  // Business
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export type AppError = {
  code: ErrorCode;
  message?: string;
  [key: string]: unknown;
};
```

## Server'da Error Fırlatma

```typescript
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: ErrorCodes.UNAUTHENTICATED });
    }
    
    const post = await ctx.db.get(postId);
    if (!post) {
      throw new ConvexError({ code: ErrorCodes.NOT_FOUND, resource: "post" });
    }
    
    if (post.authorId !== identity.subject) {
      throw new ConvexError({ 
        code: ErrorCodes.UNAUTHORIZED,
        message: "You can only delete your own posts"
      });
    }
    
    await ctx.db.delete("posts", postId);
  },
});
```

## Client'ta Error Yakalama

### Mutation Error Handling

```typescript
const deletePost = useMutation(api.posts.delete);

const handleDelete = async () => {
  try {
    await deletePost({ postId });
  } catch (error) {
    if (error instanceof ConvexError) {
      const { code, message } = error.data as AppError;
      
      switch (code) {
        case ErrorCodes.UNAUTHORIZED:
          toast.error("Permission denied");
          break;
        case ErrorCodes.NOT_FOUND:
          toast.error("Post not found");
          break;
        default:
          toast.error(message ?? "Unknown error");
      }
    }
  }
};
```

### Query Error Handling (React Error Boundary)

```typescript
// Query hataları Error Boundary ile yakalanır
import { ErrorBoundary } from "react-error-boundary";

function PostError({ error }: { error: Error }) {
  if (error instanceof ConvexError) {
    const { code } = error.data as AppError;
    if (code === ErrorCodes.NOT_FOUND) return <div>Post not found</div>;
  }
  return <div>Something went wrong</div>;
}

// Kullanım
<ErrorBoundary FallbackComponent={PostError}>
  <PostDetail postId={postId} />
</ErrorBoundary>
```

## Dev vs Production

| Ortam | Error Mesajı | Stack Trace |
|-------|-------------|-------------|
| Development | Tam mesaj | Evet |
| Production | Sadece function adı | Hayır |
| Her zaman | `ConvexError.data` | N/A |

Production'da custom `ConvexError` data korunur — diğer error mesajları redact edilir.

## Anti-patterns

```typescript
// ❌ Plain Error — production'da tamamen gizlenir
throw new Error("User not found");

// ❌ Console.error ile geçiştirme
console.error("Something failed");
return null;

// ✅ ConvexError ile typed error
throw new ConvexError({ code: ErrorCodes.NOT_FOUND, resource: "user" });
```
