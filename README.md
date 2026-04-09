# CherryJS

**The best framework for building production SaaS with AI.**

Built on [Convex](https://convex.dev) + [TanStack Start](https://tanstack.com/start) — designed from the ground up so AI coding agents write safe, consistent, production-grade code without human babysitting.

---

## Why CherryJS exists

Modern AI coding agents (Claude, Cursor, Copilot) are incredibly fast but dangerously inconsistent. They'll put business logic in the wrong layer, skip rate limiting, use raw `throw new Error()` instead of typed error factories, import across domain boundaries, and forget audit logging on admin mutations — all in the same session.

**CherryJS solves this.** Every architectural rule is enforced by automated tests. Break a rule, the test fails. The AI reads the rules, writes the code, runs the tests, and self-corrects. No human review needed for structural decisions.

The result: **you describe what to build, the AI builds it correctly the first time.**

---

## What's inside

### Backend (Convex Cloud)

| Capability | Implementation |
|-----------|---------------|
| **Auth** | Better Auth 0.11 via `@convex-dev/better-auth` — email/password, OAuth, 2FA ready |
| **Payments** | Polar via `@convex-dev/polar` — subscriptions, checkout, webhooks, customer portal |
| **Email** | Resend via `@convex-dev/resend` — durable batched delivery, webhook callbacks |
| **Storage** | Cloudflare R2 via `@convex-dev/r2` — presigned uploads, managed metadata |
| **In-app notifications** | Real-time bell-icon feed with multi-channel fan-out workflow (in-app + email + push) |
| **Content CMS** | Markdown pages with slug/locale/status lifecycle (terms, FAQ, marketing copy) |
| **Settings** | Type-safe runtime config with `SETTINGS_REGISTRY` — feature flags, limits, maintenance mode |
| **Audit logging** | Every admin action logged with typed categories and configurable retention |
| **Permissions** | Granular RBAC — roles, permissions, `canPerform()` / `assertPermission()` |
| **Rate limiting** | 6 tiers enforced on every channel mutation (strict → relaxed → burst → admin) |
| **Workflows** | Durable multi-step orchestrations via `@convex-dev/workflow` |
| **Aggregations** | O(log n) counts and sums via `@convex-dev/aggregate` |

9 Convex components. 5 business domains. 5 core infrastructure modules. 21 shared lib utilities.

### Frontend (Cloudflare Workers)

| Capability | Implementation |
|-----------|---------------|
| **Framework** | TanStack Start v2 — React 19, file-based routing, SSR on Cloudflare Workers |
| **Styling** | Tailwind v4 + OKLCH design tokens — dark mode, semantic colors only |
| **UI primitives** | 13 Radix + CVA components (Button, Card, Dialog, Select, Table, Tabs, Tooltip...) |
| **Forms** | TanStack Form + Zod via `useCherryForm()` — validation + toast feedback |
| **Tables** | TanStack Table via `useCherryTable()` — sort, filter, paginate |
| **Virtualization** | TanStack Virtual via `useCherryVirtual()` — render 10K+ rows |
| **Pacing** | TanStack Pacer — debounce, throttle, batch hooks |
| **Client state** | TanStack Store via `createCherryStore()` — wizards, drafts, sidebar state |
| **Server state** | Convex reactive queries — real-time sync over websocket, zero polling |
| **Animations** | Framer Motion presets (`fadeIn`, `slideUp`, `scaleIn`) |

### Architecture enforcement (1300+ tests)

This is what makes CherryJS different from every other template:

```
npm run check
```

One command. Five checks. Zero tolerance:

| Check | What it catches |
|-------|----------------|
| **Architectural tests** (1300+) | File naming, layer rules, import direction, line limits, rate-limit enforcement, admin marker validation, cross-domain isolation, function naming, schema rules, anti-patterns |
| **Convex ESLint** | Missing args validators, non-explicit table IDs, old function syntax, `.collect()` in queries |
| **Dependency-cruiser** | Cross-domain imports, circular dependencies, layer direction violations |
| **jscpd** | Duplicate code blocks (< 10% threshold) |
| **TypeScript** | Full strict mode, zero errors |

**If an AI agent writes code that violates any of these 1300+ rules, the test fails, and the agent fixes it before committing.** This is how you get production-safe AI coding at scale.

---

## 6-Layer Domain Architecture

Every backend domain follows the same enforced structure:

```
convex/apps/{domain}/
├── {domain}Schema.ts        # Table definitions + indexes
├── {domain}Model.ts         # Pure DB read helpers (get*, list*, find*)
├── {domain}Business.ts      # ALL business logic (internal mutations/queries)
├── {domain}Channel.ts       # Public API — rate-limited, audited, max 200 lines
├── {domain}Integration.ts   # External APIs (fetch allowed HERE ONLY)
└── {domain}Workflow.ts       # Multi-step durable orchestrations
```

**Rules enforced by test:**
- Channel handlers max 20 lines — delegate to business
- Every channel mutation MUST use a rate-limited wrapper
- `@admin` marker required on admin endpoints + mandatory audit logging
- No cross-domain DB access — use `ctx.runQuery(internal.apps.{other}...)` 
- Model functions must return `null`, never throw
- `fetch()` only in integration files
- No `throw new Error()` — use typed `errors.notFound()`, `errors.forbidden()`, etc.

---

## Quick start

```bash
git clone https://github.com/cheryiit/cherryjs.git my-saas
cd my-saas
npm install

# Initialize Convex (creates .env.local + _generated/)
npx convex dev
# Stop with Ctrl+C once "Convex functions ready!" appears

# Verify everything passes
npm run check

# Run locally (two terminals)
npm run convex:dev    # Backend (hot-push)
npm run dev           # Frontend (localhost:3000)
```

Add a new domain:
```bash
cp -r convex/apps/_template convex/apps/products
# Rename files: _template → products
# Find-replace "_template" → "products"
# Add to convex/schema.ts
npm run check
```

Or let the AI do it: `/add-domain products`

---

## AI-native developer experience

CherryJS ships with **11 Claude Code skills** that let AI scaffold code correctly:

| Command | What it does |
|---------|-------------|
| `/add-domain products` | Scaffold backend domain (all 6 layers) |
| `/add-feature checkout` | Create frontend feature module |
| `/add-ui-component date-picker` | New Radix+CVA primitive |
| `/add-setting withdraw.dailyLimit` | Register a runtime config |
| `/add-content terms-of-service` | Add CMS page |
| `/add-store wizardDraft` | Client-only reactive state |
| `/simplify convex/apps/users/` | Clean code review + fix |
| `/validate-all` | Full `npm run check` pipeline |

Plus **12 rules files** (`.claude/rules/`) that auto-load when the AI touches relevant code — admin security rules, design token catalog, settings patterns, layer conventions, and more.

**The AI doesn't guess. It reads the rules, follows the patterns, and the tests verify.**

---

## Built for autonomous AI operation

> *"The goal is a project that runs 24/7 with an AI coding agent handling maintenance, features, and deployments — making every decision autonomously while the architectural tests ensure nothing breaks."*

CherryJS is designed with this future in mind:

- **Every rule is a test, not a comment.** AI can verify its own work with `npm run check`
- **Convex MCP server** gives AI direct access to deployment data, env vars, function logs, and insights
- **GitHub Actions CI** catches anything the AI misses before merge
- **Audit logging** creates a paper trail of every admin action the AI takes
- **Rate limiting** prevents AI from accidentally DDoS-ing external APIs
- **`@admin` markers** ensure the AI can't accidentally expose admin-only endpoints to public users
- **Settings registry** lets the AI change runtime config without code deploys

The framework doesn't just help AI write code — it makes AI-written code **trustworthy**.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Convex (reactive BaaS) |
| Frontend | TanStack Start v2 (React 19, SSR) |
| HTTP | Hono (webhooks + REST inside Convex) |
| Auth | Better Auth 0.11 + `@convex-dev/better-auth` |
| Payments | Polar + `@convex-dev/polar` |
| Email | Resend + `@convex-dev/resend` |
| Storage | Cloudflare R2 + `@convex-dev/r2` |
| Styling | Tailwind v4 + OKLCH design tokens |
| UI | Radix primitives + CVA + `cn()` |
| Forms | TanStack Form + Zod |
| Tables | TanStack Table |
| Virtualization | TanStack Virtual |
| Client state | TanStack Store |
| Animations | Framer Motion |
| Frontend deploy | Cloudflare Workers (Alchemy) |
| Backend deploy | Convex Cloud |
| Tests | Vitest (1300+ architectural) |
| Lint | ESLint (`@convex-dev/eslint-plugin`) + dependency-cruiser + jscpd |
| CI | GitHub Actions |

---

## Project structure

```
convex/
  convex.config.ts       # 9 components mounted
  schema.ts              # Aggregator (no defineTable here)
  auth.ts                # Better Auth triggers
  http.ts                # Hono router
  lib/                   # 21 shared modules (standalone)
  core/                  # 5 infra modules (audit, parameter, schedule, webhook, content)
  apps/                  # 5 domains + _template scaffolding
    users/               # Auth profiles, roles, admin ops
    payments/            # Polar wrapper (component owns tables)
    waitlist/            # Pre-launch email collection
    notifications/       # Outbound email logs
    inAppNotifications/  # Real-time bell-icon feed + fan-out workflow
    _template/           # Copy this to start a new domain

app/
  lib/                   # 13 shared utilities
  components/ui/         # 13 Radix+CVA primitives
  components/layout/     # Navbar, Footer, LayoutMain
  features/              # Business UI modules
  routes/                # File-based pages
  styles/globals.css     # Tailwind v4, OKLCH tokens, dark mode

tests/
  backend/               # Architecture, enforcement, tech-adoption, admin-security, lib-integrity
  frontend/              # Architecture, design-tokens, responsive-scoring, lib-integrity
  structural-integrity   # Filesystem firewall
  code-quality           # dependency-cruiser + jscpd
```

---

## License

**Proprietary.** All rights reserved. See [LICENSE](./LICENSE) for details.

This software may not be used, copied, modified, or distributed for commercial purposes without explicit written permission from the author.

---

**Built with Convex, TanStack, and Claude.** The framework where AI writes production code you can actually trust.
