import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "~/app/lib/seo";
import { config } from "~/app/lib/config";
import { LayoutMain } from "~/app/components/layout/LayoutMain";
import { Button } from "~/app/components/ui/button";

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
    <LayoutMain>
      <section className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
          {config.metadata.siteName}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {config.metadata.siteDescription}
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <a href="/api/auth/signin">Get Started</a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="/dashboard">Dashboard</a>
          </Button>
        </div>
      </section>
    </LayoutMain>
  );
}
