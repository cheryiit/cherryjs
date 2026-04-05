# Clerk + Convex Entegrasyonu

Kaynak: https://docs.convex.dev/auth/clerk

## Kurulum Adimlari

### 1. Clerk Hesabi ve Convex Entegrasyonu

1. [clerk.com](https://clerk.com) hesabi olustur
2. Clerk Dashboard → Integrations → Convex aktifleştir
3. Frontend API URL'ini kopyala: `https://verb-noun-00.clerk.accounts.dev`

### 2. Convex Tarafinda Yapılandırma

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

### 3. Ortam Degiskenleri

```bash
# Convex dashboard'a ekle
CLERK_JWT_ISSUER_DOMAIN=https://verb-noun-00.clerk.accounts.dev

# Uygulama .env.local'a
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# veya
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 4. Paket Kurulumu

```bash
pnpm add @clerk/tanstack-start convex
# veya Next.js icin
pnpm add @clerk/nextjs convex
```

### 5. Provider Yapılandırması

**TanStack Start:**
```typescript
// app/routes/__root.tsx
import { ClerkProvider, useAuth } from "@clerk/tanstack-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function RootComponent() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Outlet />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## Kullanici Kayit / Giris

```typescript
// Sign In butonu
import { SignInButton, SignOutButton, useUser } from "@clerk/tanstack-start";
import { Authenticated, Unauthenticated } from "convex/react";

function AuthButtons() {
  return (
    <>
      <Authenticated>
        <SignOutButton />
      </Authenticated>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
    </>
  );
}
```

## Auth Durumu Kontrolu

```typescript
// Convex auth'u kullan (Clerk'in useAuth degil)
import { useConvexAuth } from "convex/react";

function ProtectedComponent() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <SignInPage />;
  
  return <Dashboard />;
}
```

## Convex Fonksiyonlarinda Clerk Bilgileri

```typescript
export const getProfile = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return {
      // Clerk ile gelen ekstra alanlar:
      name: identity.name,
      email: identity.email,
      emailVerified: identity.emailVerified,
      pictureUrl: identity.pictureUrl,
      // Her zaman mevcut:
      subject: identity.subject,           // Clerk User ID
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
```

## Dev vs Prod Keys

| Ortam | Publishable Key Format |
|-------|----------------------|
| Development | `pk_test_...` |
| Production | `pk_live_...` |

Convex dashboard'da her deployment icin ayri CLERK_JWT_ISSUER_DOMAIN ayarla.

## Webhook ile Kullanici Senkronizasyonu

```typescript
// convex/http.ts — Clerk webhook
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text();
    const signature = request.headers.get("svix-signature");
    
    // Webhook dogrulama
    // ...
    
    const event = JSON.parse(payload);
    
    if (event.type === "user.created") {
      await ctx.runMutation(internal.users.create, {
        clerkId: event.data.id,
        email: event.data.email_addresses[0].email_address,
        name: `${event.data.first_name} ${event.data.last_name}`,
      });
    }
    
    return new Response("OK");
  }),
});
```
