---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
---

# TanStack Ecosystem Usage Rules

CherryJS uses 6 TanStack tools. Each has a specific purpose. **Pick the right one — they don't overlap.**

## Decision Tree: Where Does My State Live?

```
Is the data on the server?
├─ YES → Convex (useQuery from app/lib/convex)
│         Convex IS our reactive sync layer.
│
└─ NO → Is it form input being submitted right now?
         ├─ YES → useCherryForm() from app/lib/form
         │         (TanStack Form + Zod + toast feedback)
         │
         └─ NO → Is it ephemeral component-local state?
                  ├─ YES → useState (built-in React)
                  │
                  └─ NO → Shared across components but client-only?
                           ├─ YES → createCherryStore() from app/lib/store
                           │         (TanStack Store — multi-step drafts,
                           │          sidebar collapsed, filter wizards)
                           │
                           └─ NO → Search params (URL)?
                                    └─ Use TanStack Router validateSearch
```

## When to Use Each Tool

### `useState` — Built-in React
Component-local state. Resets on unmount. Re-renders only this component.
```tsx
const [open, setOpen] = useState(false); // Modal open state
```

### `useCherryForm()` — `app/lib/form`
Form being filled and submitted. Built on TanStack Form.
- Validates with Zod
- Shows toast on success/error
- Tracks dirty/touched/errors per field
```tsx
const form = useCherryForm({
  defaultValues: { email: "" },
  schema: z.object({ email: z.string().email() }),
  onSubmit: async (values) => createUser(values),
  successMessage: "Account created",
});
```

### `useCherryTable()` — `app/lib/table`
Tabular data display with sorting, filtering, pagination.
```tsx
const table = useCherryTable({
  data: users, // from useQuery
  columns: [...],
  initialPageSize: 20,
});
```

### `useCherryVirtual()` — `app/lib/virtual`
Long lists (1000+ items) — only renders visible rows.
```tsx
const virtualizer = useCherryVirtual({
  count: items.length,
  parentRef: scrollRef,
  estimateSize: () => 48,
});
```

### Pacer hooks — `app/lib/pacer`
Debounce, throttle, batch.
```tsx
const debouncedQuery = useDebouncedValue(query, { wait: 300 }); // Search
const throttledScroll = useThrottledCallback(handler, { wait: 100 }); // Scroll
```

### `createCherryStore()` — `app/lib/store`
Client-only reactive state shared across components.
- Multi-step form drafts
- Sidebar collapsed/expanded
- Wizard step state
- Undo/redo stacks
```tsx
export const wizardStore = createCherryStore({
  step: 0 as 0 | 1 | 2,
  data: { name: "", role: "user" },
});

// In component:
const step = useStoreSelector(wizardStore, (s) => s.step);
wizardStore.setState((s) => ({ ...s, step: 1 }));
```

### Convex hooks — `app/lib/convex`
Server data. Already reactive — re-renders on server changes.
```tsx
const users = useQuery(api.apps.users.usersChannel.list, {});
const createUser = useMutation(api.apps.users.usersChannel.create);
```

## Forbidden Patterns

| Anti-pattern | Use instead |
|--------------|-------------|
| `createCherryStore({ users: [] })` then fetch from API | `useQuery(api...)` — Convex IS the store |
| `useState` shared via prop drilling 3+ levels | `createCherryStore()` |
| `useEffect(() => fetch())` for data | `useQuery(api...)` |
| `useState` for form values + manual validation | `useCherryForm()` |
| `setTimeout` for debounce | `useDebouncedValue()` |
| Manual `<table>` markup with sort logic | `useCherryTable()` + `Table` UI |
| Rendering 10,000 items with `.map()` | `useCherryVirtual()` |
| Storing auth/session in a store | Use Better-Auth (`useSession`) |

## Why We DON'T Use

- **TanStack DB** — Convex IS the reactive sync layer. Adding TanStack DB creates two sources of truth. Only consider for offline-first apps.
- **TanStack Ranger** — Radix Slider is more complete (ARIA, keyboard nav).
- **TanStack Config** — Wrong use case (npm package authoring tool).
- **Zustand / Jotai / Valtio** — TanStack Store is the canonical choice for our ecosystem (integrates with TanStack DevTools).
