---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
---

# Frontend Component Rules

## Component Naming (enforced by test)
File name PascalCase must start with approved prefix:

**Layout:** Layout, Container, Section, Grid, Stack, Sidebar
**Navigation:** Navbar, Nav, Breadcrumb, Pagination, Tab, Menu
**Data Display:** Card, Table, List, Badge, Avatar, Stat, Timeline, Chart, Empty, Skeleton
**Form:** Form, Input, Select, Checkbox, Radio, Switch, Slider, Textarea, DatePicker, Upload, Search, Label
**Action:** Button, Link, Icon, Dropdown
**Feedback:** Alert, Toast, Progress, Spinner, Error
**Overlay:** Modal, Dialog, Drawer, Popover, Tooltip, Sheet, Command
**Typography:** Text, Heading, Code
**Media:** Image, Video
**Animation:** Animate, Transition, Motion
**Other:** Separator, Divider, Provider, Theme

Each type has a max line limit (Button: 80, Card: 120, Dialog: 150, Table: 200, Dropdown: 250).

## Component Rules
- **Named exports only** — no `export default`
- **Use `cn()`** for className merging (clsx + tailwind-merge)
- **No hardcoded hex** in className — use semantic tokens (bg-primary, text-muted-foreground)
- **CVA for variants** — use class-variance-authority for multi-variant components
- **Radix primitives** for interactive behavior (Dialog, DropdownMenu, Select, etc.)

## Route Rules
- Max 100 lines per route file
- No `useState()` or `useEffect()` — delegate to features/hooks
- Use `seoHead()` from `app/lib/seo` for meta tags

## Responsive Design (scored A-F)
Components must score >= 60 (grade C):
- `w-[400px]+` without `sm:/md:/lg:` variant -> HIGH severity
- `grid-cols-3+` without responsive -> HIGH severity
- Table without `overflow-x-auto` -> HIGH severity
- Large text (4xl+) without responsive -> MEDIUM

## Frontend Shared Utilities
| Need | Import from |
|------|-------------|
| Class merging | `app/lib/utils` -> `cn()` |
| Forms | `app/lib/form` -> `useCherryForm()` |
| Toasts | `app/lib/toast` -> `withToast()` |
| Animations | `app/lib/motion` -> `fadeIn`, `slideUp`, etc. |
| Convex hooks | `app/lib/convex` -> `useQuery`, `useMutation` |
| Auth | `app/lib/auth-client` -> `signIn`, `signUp` |
| SEO | `app/lib/seo` -> `seoHead()` |
| Config | `app/lib/config` -> feature flags |
