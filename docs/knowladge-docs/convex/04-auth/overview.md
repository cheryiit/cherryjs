# Convex Authentication

Kaynak: https://docs.convex.dev/auth

## Nasil Calisir?

Convex **OpenID Connect (OIDC) JWT token'lari** ile kimlik dogrulama yapar. Token WebSocket baglantisinda ve RPC'lerde kullanilir.

## Desteklenen Provider'lar

| Provider | Ozellik | Ideal Kullanim |
|----------|---------|----------------|
| **Clerk** | En iyi React/TanStack entegrasyonu | Cogu proje |
| **WorkOS AuthKit** | B2B odakli, 1M kullaniciya kadar ucretsiz | Enterprise |
| **Auth0** | Kapsamli ozellikler, establish platform | Mevcut Auth0 altyapisi |
| **Custom OIDC** | Kendi JWT provider'in | Ozel ihtiyaclar |
| **Convex Auth** (beta) | Harici servis gerektirmez | Hizli baslangic |

## Auth Flow

```
1. Kullanici Clerk UI'da login olur
2. Clerk JWT token üretir
3. ConvexProviderWithClerk → token'i Convex'e gönderir
4. Convex backend → Clerk public key ile token dogrular
5. ctx.auth.getUserIdentity() → UserIdentity döner
6. useConvexAuth() → authenticated: true
```

## Convex Fonksiyonlarinda Auth

```typescript
const identity = await ctx.auth.getUserIdentity();

// Unauthenticated
if (identity === null) {
  throw new ConvexError({ code: "UNAUTHENTICATED" });
}

// identity alanlari:
identity.tokenIdentifier  // subject + issuer (unique ID)
identity.subject          // Provider'in user ID'si
identity.issuer           // Token issuer URL
identity.email            // Email (Clerk/Auth0 ile)
identity.emailVerified    // Email dogrulandi mi?
identity.name             // Tam isim
```

## Kullanici Tablosu Pattern'i

```typescript
// schema.ts
users: defineTable({
  tokenIdentifier: v.string(), // ctx.auth identity.tokenIdentifier
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("user")),
  avatarUrl: v.optional(v.string()),
})
  .index("by_token", ["tokenIdentifier"]),

// model/users.ts
export async function getCurrentUser(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  
  return ctx.db
    .query("users")
    .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function getCurrentUserOrThrow(ctx: MutationCtx | QueryCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return user;
}
```

## Service Authentication (Backend-to-Backend)

```typescript
// Harici servislerden Convex cagirma
const client = new ConvexClient(process.env.CONVEX_URL!);
client.setAuth(process.env.CONVEX_SERVICE_SECRET!);

await client.mutation(api.internal.processJob, { jobId });
```

## React Provider Setup

```typescript
// app/root.tsx (TanStack Start)
import { ClerkProvider, useAuth } from "@clerk/tanstack-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.CONVEX_URL!);

export function App() {
  return (
    <ClerkProvider publishableKey={process.env.CLERK_PUBLISHABLE_KEY!}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <RouterProvider router={router} />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## auth.config.ts

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      // Clerk issuer domain
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```
