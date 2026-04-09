---
paths:
  - "app/**/*.ts"
  - "app/**/*.tsx"
---

# Frontend lib/ Reference (13 modules)

Complete catalog of `app/lib/*` shared utilities. **Always check this list before writing utility code — it probably already exists.**

## utils — `app/lib/utils.ts`

Class merging.

```tsx
import { cn } from "~/app/lib/utils";

<div className={cn("base-classes", isActive && "active", className)} />
```

## auth-client — `app/lib/auth-client.ts`

Better-Auth React client. Use in components.

```tsx
import { signIn, signUp, signOut, useSession, authClient } from "~/app/lib/auth-client";

const { data: session } = useSession();
await signIn.email({ email, password });
```

## auth-server — `app/lib/auth-server.ts`

SSR auth helpers. Use in route loaders / server functions.

```ts
import { handler, getToken, fetchQuery, fetchMutation } from "~/app/lib/auth-server";

// In createServerFn:
const token = await getToken();
```

## config — `app/lib/config.ts`

Build-time feature flags and metadata.

```tsx
import { config } from "~/app/lib/config";

if (config.features.payments) { ... }
const siteName = config.metadata.siteName;
```

## convex — `app/lib/convex.ts`

Convex hooks barrel.

```tsx
import {
  useQuery, useMutation, useAction, usePaginatedQuery,
  Authenticated, Unauthenticated, AuthLoading,
  api, internal,
  extractConvexError,
} from "~/app/lib/convex";

const users = useQuery(api.apps.users.usersChannel.list, {});
const createUser = useMutation(api.apps.users.usersChannel.create);
```

## form — `app/lib/form.ts`

Forms with Zod validation + toast feedback (built on TanStack Form).

```tsx
import { useCherryForm } from "~/app/lib/form";
import { z } from "zod";

const form = useCherryForm({
  defaultValues: { email: "", password: "" },
  schema: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  onSubmit: async (values) => signIn.email(values),
  successMessage: "Signed in",
});
```

## toast — `app/lib/toast.ts`

Async toast wrapper (built on Sonner).

```tsx
import { withToast, toast } from "~/app/lib/toast";

await withToast(
  () => updateProfile({ name }),
  { loading: "Saving...", success: "Saved", error: "Failed to save" },
);

toast.success("Done");  // direct sonner access
```

## motion — `app/lib/motion.ts`

Framer Motion presets. **Don't write inline motion props.**

```tsx
import { motion } from "framer-motion";
import { fadeIn, fadeInUp, slideUp, slideInLeft, scaleIn, staggerContainer, staggerItem } from "~/app/lib/motion";

<motion.div {...fadeIn}>Hello</motion.div>
<motion.div {...slideUp} transition={{ delay: 0.2 }}>World</motion.div>

<motion.ul {...staggerContainer}>
  {items.map((i) => <motion.li key={i.id} {...staggerItem}>{i.name}</motion.li>)}
</motion.ul>
```

## seo — `app/lib/seo.ts`

Meta tags and JSON-LD structured data.

```tsx
import { seoHead, organizationJsonLd, websiteJsonLd } from "~/app/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seoHead({
      title: "Page Title",
      description: "...",
      url: "https://example.com",
      image: "https://example.com/og.png",
    }),
  }),
});
```

## table — `app/lib/table.ts`

TanStack Table wrapper.

```tsx
import { useCherryTable, type TableColumn, flexRender } from "~/app/lib/table";

const columns: TableColumn<User>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
];

const table = useCherryTable({
  data: users,
  columns,
  initialPageSize: 20,
});

// Pair with <Table>, <TableHeader>, <TableBody>, etc. from app/components/ui/table.tsx
```

## virtual — `app/lib/virtual.ts`

TanStack Virtual wrapper for long lists (1000+ items).

```tsx
import { useCherryVirtual } from "~/app/lib/virtual";

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useCherryVirtual({
  count: items.length,
  parentRef,
  estimateSize: () => 48,
});

return (
  <div ref={parentRef} className="h-[600px] overflow-auto">
    <div style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((vi) => (
        <div key={vi.key} style={{ position: "absolute", top: vi.start, height: vi.size }}>
          {items[vi.index]?.name}
        </div>
      ))}
    </div>
  </div>
);
```

## pacer — `app/lib/pacer.ts`

Debounce, throttle, batch hooks (TanStack Pacer).

```tsx
import {
  useDebouncedValue,
  useDebouncedCallback,
  useDebouncedState,
  useThrottledValue,
  useThrottledCallback,
  useRateLimitedCallback,
  useBatcher,
} from "~/app/lib/pacer";

// Search input
const [query, setQuery] = useState("");
const debouncedQuery = useDebouncedValue(query, { wait: 300 });

// Throttled scroll
const onScroll = useThrottledCallback((e) => trackScroll(e), { wait: 100 });
```

## store — `app/lib/store.ts`

TanStack Store wrapper for client-only reactive state.

```tsx
import { createCherryStore, useStoreSelector } from "~/app/lib/store";

// Define
export const wizardStore = createCherryStore({
  step: 0 as 0 | 1 | 2,
  data: { name: "", email: "" },
});

// Read (granular)
function StepIndicator() {
  const step = useStoreSelector(wizardStore, (s) => s.step);
  return <div>Step {step + 1}/3</div>;
}

// Write
wizardStore.setState((s) => ({ ...s, step: 1 }));
```

**Never put server data in stores** — use Convex queries instead. Enforced by `tests/frontend/tanstack-usage.test.ts`.

---

## Quick Decision Tree

```
Need to... → Use
─────────────────────────────────────────────
merge classNames       → cn()
sign in/up/out         → auth-client (signIn/signUp/signOut)
get session SSR        → auth-server (getToken, fetchQuery)
read feature flag      → config.features.X
fetch server data      → useQuery from convex
mutate server data     → useMutation from convex
extract Convex error   → extractConvexError(err)
build a form           → useCherryForm() + Zod schema
async + toast          → withToast(fn, messages)
direct toast           → toast.success/.error
animate element        → motion.div + fadeIn/slideUp presets
SEO meta tags          → seoHead({...}) in route head()
JSON-LD structured     → organizationJsonLd(config) etc.
data table             → useCherryTable + Table UI components
long list (1000+)      → useCherryVirtual()
debounce input         → useDebouncedValue(value, { wait: 300 })
throttle handler       → useThrottledCallback(fn, { wait: 100 })
client reactive state  → createCherryStore() + useStoreSelector()
```
