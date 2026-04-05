import { createFileRoute, redirect } from "@tanstack/react-router";
import { seoHead } from "~/app/lib/seo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: seoHead({
      title: "Dashboard",
      description: "Your dashboard",
    }),
  }),
  beforeLoad: async ({ context }) => {
    // Redirect to home if not authenticated
    // Token is set by __root.tsx beforeLoad
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold font-display tracking-tight">
        Dashboard
      </h1>
    </main>
  );
}
