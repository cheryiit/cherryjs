import { Link } from "@tanstack/react-router";
import { Button } from "~/app/components/ui/button";
import { useSession } from "~/app/lib/auth-client";
import { config } from "~/app/lib/config";
import { cn } from "~/app/lib/utils";

function Navbar({ className }: { className?: string }) {
  const { data: session } = useSession();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="font-display text-lg font-bold tracking-tight">
          {config.metadata.siteName}
        </Link>

        <nav className="flex items-center gap-2">
          {session ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/auth/signin">Sign in</a>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export { Navbar };
