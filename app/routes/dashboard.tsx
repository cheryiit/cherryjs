import { createFileRoute, redirect } from "@tanstack/react-router";
import { seoHead } from "~/app/lib/seo";
import { LayoutMain } from "~/app/components/layout/LayoutMain";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: seoHead({ title: "Dashboard", description: "Your dashboard" }),
  }),
  beforeLoad: async ({ context }) => {
    if (!context.token) {
      throw redirect({ to: "/" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <LayoutMain>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold font-display tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back. Start building your features here.
        </p>
      </div>
    </LayoutMain>
  );
}
