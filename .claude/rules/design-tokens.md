---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
  - "app/styles/**"
---

# Design Token System

CherryJS uses a two-layer color system with OKLCH + Tailwind v4 `@theme`.

## How It Works

1. **Raw OKLCH values** defined in `:root` / `.dark` as CSS variables
2. **Semantic mapping** in `@theme inline` creates Tailwind utility classes
3. **Components use ONLY semantic tokens** — never raw colors

## Available Semantic Tokens

### Surface Colors
| Token | Tailwind Class | Purpose |
|-------|---------------|---------|
| `--background` | `bg-background` | Page background |
| `--foreground` | `text-foreground` | Default text |
| `--card` | `bg-card` | Card/container surface |
| `--card-foreground` | `text-card-foreground` | Card text |
| `--popover` | `bg-popover` | Popover/dropdown surface |
| `--popover-foreground` | `text-popover-foreground` | Popover text |

### Interactive Colors
| Token | Tailwind Class | Purpose |
|-------|---------------|---------|
| `--primary` | `bg-primary`, `text-primary` | Primary actions, links |
| `--primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--secondary` | `bg-secondary` | Secondary actions |
| `--secondary-foreground` | `text-secondary-foreground` | Text on secondary bg |
| `--accent` | `bg-accent` | Hover states, highlights |
| `--accent-foreground` | `text-accent-foreground` | Text on accent bg |
| `--destructive` | `bg-destructive` | Delete, error actions |
| `--destructive-foreground` | `text-destructive-foreground` | Text on destructive bg |

### Utility Colors
| Token | Tailwind Class | Purpose |
|-------|---------------|---------|
| `--muted` | `bg-muted` | Subtle backgrounds |
| `--muted-foreground` | `text-muted-foreground` | Secondary/helper text |
| `--border` | `border-border` | Default borders |
| `--input` | `border-input` | Form input borders |
| `--ring` | `ring-ring` | Focus ring color |

### Chart Colors (data visualization only)
`--chart-1` through `--chart-5` — use only in Chart components.

### Sidebar Colors
`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` — use only in Sidebar components.

## Opacity Modifiers

Use Tailwind opacity syntax with semantic tokens:
- `bg-primary/90` — primary with 90% opacity (hover state)
- `bg-background/60` — semi-transparent background (blur overlay)
- `bg-black/80` — overlay backdrop

## Radius Scale

| Token | Class | Value |
|-------|-------|-------|
| `--radius-sm` | `rounded-sm` | radius - 4px |
| `--radius-md` | `rounded-md` | radius - 2px |
| `--radius-lg` | `rounded-lg` | radius (base) |
| `--radius-xl` | `rounded-xl` | radius + 4px |

## Rules (enforced by test)

1. **NEVER use arbitrary color values** in className:
   - `bg-[#ff0000]` — FORBIDDEN
   - `text-[oklch(0.5 0.2 250)]` — FORBIDDEN
   - `border-[rgb(255,0,0)]` — FORBIDDEN
   - `bg-red-500` — FORBIDDEN (Tailwind palette colors not in our theme)

2. **ALWAYS use semantic tokens:**
   - `bg-primary` not `bg-blue-600`
   - `text-muted-foreground` not `text-gray-500`
   - `border-border` not `border-slate-200`

3. **Every `:root` token MUST have a `.dark` counterpart**

4. **Exception:** `bg-black/80` is allowed for overlay backdrops (with `// cherry:allow` if needed)

## Adding New Colors

If you need a new semantic color (e.g., `--success`, `--warning`):
1. Add OKLCH values to both `:root` and `.dark` in `globals.css`
2. Map it in `@theme inline` as `--color-{name}: var(--{name})`
3. Update this document
4. Run `npm run test:arch` to verify
