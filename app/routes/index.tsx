import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "~/app/lib/seo";
import { config } from "~/app/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seoHead({
      title: config.metadata.siteName,
      description: config.metadata.siteDescription,
    }),
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold font-display tracking-tight">
        {config.metadata.siteName}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {config.metadata.siteDescription}
      </p>
    </main>
  );
}
