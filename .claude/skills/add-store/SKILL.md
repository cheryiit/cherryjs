---
name: add-store
description: Create a TanStack Store for client-only reactive state (multi-step forms, wizards, sidebar state). Do NOT use for server data.
---

Create a typed TanStack Store called `$ARGUMENTS` for client-only reactive state.

## When to Use This (vs alternatives)

- **Server data** → Convex `useQuery`, NOT a store
- **Form being submitted** → `useCherryForm()`, NOT a store
- **Component-local UI state** → `useState`, NOT a store
- **URL-based state** (filters, pagination) → TanStack Router `validateSearch`, NOT a store
- **Auth/session** → Better-Auth `useSession`, NOT a store
- **Shared client state across components** → ✅ TanStack Store

## Steps

1. Decide where the store lives:
   - Feature-specific → `app/features/{feature}/{name}.store.ts`
   - App-wide (e.g., sidebar) → `app/lib/{name}.store.ts` (rare; prefer feature scope)

2. Define the store with `createCherryStore`:

```ts
import { createCherryStore } from "~/app/lib/store";

export const wizardStore = createCherryStore({
  step: 0 as 0 | 1 | 2 | 3,
  data: {
    name: "",
    email: "",
    role: "user" as "user" | "admin",
  },
});
```

3. Read with granular selector (only re-renders when slice changes):

```tsx
import { useStoreSelector } from "~/app/lib/store";
import { wizardStore } from "../wizard.store";

function StepIndicator() {
  const step = useStoreSelector(wizardStore, (s) => s.step);
  return <div>Step {step + 1}/4</div>;
}
```

4. Update with `setState`:

```tsx
function NextButton() {
  return (
    <Button onClick={() =>
      wizardStore.setState((s) => ({ ...s, step: (s.step + 1) as 0 | 1 | 2 | 3 }))
    }>
      Next
    </Button>
  );
}
```

5. Reset when done:

```tsx
function FinishButton() {
  const submit = useMutation(api.apps.users.usersChannel.createFromWizard);
  return (
    <Button onClick={async () => {
      await submit({ data: wizardStore.state.data });
      wizardStore.setState(() => ({
        step: 0,
        data: { name: "", email: "", role: "user" },
      }));
    }}>
      Finish
    </Button>
  );
}
```

6. Run `npm run test:arch` — verify no architectural violations.

## Reference

- Wrapper: `app/lib/store.ts`
- Rules: `.claude/rules/tanstack-usage.md`
- Decision tree: see "Where Does My State Live?" in tanstack-usage.md
