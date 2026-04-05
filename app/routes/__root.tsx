import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ConvexProvider } from "convex/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "~/app/components/theme-provider";
import { getToken } from "~/app/lib/auth-server";
import type { RouterContext } from "~/app/router";
import appCss from "~/app/styles/globals.css?url";

const fetchAuth = createServerFn({ method: "GET" }).handler(async () => {
  const token = await getToken();
  return { token };
});

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/inter-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  beforeLoad: async (ctx) => {
    const { token } = await fetchAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { token };
  },
  component: RootComponent,
});

function RootComponent() {
  const { convexClient } = Route.useRouteContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ConvexProvider client={convexClient}>
          <ThemeProvider>
            <Outlet />
            <Toaster richColors />
          </ThemeProvider>
        </ConvexProvider>
        <Scripts />
      </body>
    </html>
  );
}
