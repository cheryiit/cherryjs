---
name: add-feature
description: Create a new frontend feature module with components, hooks, and types
---

Create a new feature module called `$ARGUMENTS`.

1. Create `app/features/$ARGUMENTS/` directory (kebab-case name)
2. Create structure:
   ```
   app/features/$ARGUMENTS/
     components/    # Feature-specific components
     hooks/         # Custom hooks (useXxx naming)
     types.ts       # Feature type definitions (optional)
   ```
3. Components import Convex hooks from `app/lib/convex` (useQuery, useMutation)
4. No direct convex/_generated/api imports in components — use hooks
5. No useState/useEffect in route files — put them in hooks
6. Use `withToast()` for mutation feedback
7. Use `useCherryForm()` for forms with validation
8. Use `seoHead()` in route head() for SEO meta
9. If the feature needs a backend domain, use `/add-domain` first

Reference existing route: `app/routes/dashboard.tsx`, `app/routes/index.tsx`
