import { config } from "~/app/lib/config";
import { cn } from "~/app/lib/utils";

function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t py-6", className)}>
      <div className="container mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {config.metadata.siteName}
      </div>
    </footer>
  );
}

export { Footer };
