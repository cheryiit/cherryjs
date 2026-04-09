---
name: add-ui-component
description: Create a new Radix+CVA UI component following CherryJS conventions
---

Create a new UI component called `$ARGUMENTS`.

1. Create `app/components/ui/$ARGUMENTS.tsx`
2. File name PascalCase must start with approved prefix (Button, Card, Dialog, Input, Select, etc.)
3. Use Radix UI primitive if interactive (Dialog, DropdownMenu, Tooltip, Select, Tabs, etc.)
4. Use CVA (class-variance-authority) for variant management
5. Use `cn()` from `app/lib/utils` for class merging
6. Named exports only — NO `export default`
7. Use `React.forwardRef` for all interactive Radix wrappers, set `displayName`
8. No hardcoded hex colors — use semantic tokens (bg-primary, text-muted-foreground)
9. Respect max line limit for the component type
10. Run `npm run test:arch` — verify naming, exports, responsive scoring pass

Reference existing components: `app/components/ui/button.tsx`, `app/components/ui/dialog.tsx`
