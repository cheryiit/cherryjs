# Clerk + TanStack Start Entegrasyonu

Kaynak: https://docs.convex.dev/auth/clerk
Referans: https://clerk.com/docs/references/tanstack/tanstack-start

## Kurulum

```bash
pnpm add @clerk/tanstack-start
```

## Ortam Degiskenleri

```bash
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex dashboard'a
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
```

## app.config.ts

```typescript
// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";

export default defineConfig({
  tsr: {
    appDirectory: "./src",
  },
});
```

## Root Route Kurulumu

```typescript
// src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Outlet,
  ScrollRestoration,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-start";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/tanstack-start";
import { ConvexReactClient } from "convex/react";
import type { QueryClient } from "@tanstack/react-query";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <html>
          <head />
          <body>
            <Outlet />
            <ScrollRestoration />
          </body>
        </html>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## Protected Routes Pattern

```typescript
// src/routes/_authenticated.tsx — Auth gerektiren layout
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getAuth } from "@clerk/tanstack-start/server";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const auth = await getAuth(context.request);
    if (!auth.userId) {
      throw redirect({ to: "/login", search: { returnTo: context.pathname } });
    }
  },
  component: () => <Outlet />,
});

// _authenticated altindaki tum route'lar korunur:
// src/routes/_authenticated/dashboard.tsx → /dashboard
// src/routes/_authenticated/settings.tsx → /settings
```

## Auth Durumu Hook'lari

```typescript
import {
  useUser,
  useAuth,
  useClerk,
  SignInButton,
  SignOutButton,
  UserButton,
  SignedIn,
  SignedOut,
} from "@clerk/tanstack-start";
import { useConvexAuth } from "convex/react";

function NavBar() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  
  return (
    <nav>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button>Sign In</button>
        </SignInButton>
      </SignedOut>
    </nav>
  );
}
```

## Login Sayfasi

```typescript
// src/routes/login.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/tanstack-start";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn
        routing="path"
        path="/login"
        forceRedirectUrl={returnTo ?? "/dashboard"}
      />
    </div>
  );
}
```

## Server-Side Auth (Server Functions)

```typescript
// src/server/auth.ts
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@clerk/tanstack-start/server";

export const getCurrentUser = createServerFn()
  .handler(async ({ request }) => {
    const auth = await getAuth(request);
    return auth.userId ? auth : null;
  });

// Route loader'da
export const Route = createFileRoute("/profile")({
  loader: async ({ context }) => {
    const auth = await getCurrentUser();
    if (!auth) throw redirect({ to: "/login" });
    return { userId: auth.userId };
  },
  component: ProfilePage,
});
```

## Convex auth.config.ts

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
