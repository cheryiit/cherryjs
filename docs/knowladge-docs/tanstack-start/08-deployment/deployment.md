# TanStack Start Deployment

Kaynak: https://tanstack.com/start/latest

## Hosting Secenekleri

TanStack Start **Vite + Nitro** uzerine kurulu — evrensel deployment destegi.

| Platform | Gereklilik | Not |
|----------|-----------|-----|
| Vercel | `@nitropack/vercel` | Otomatik detect |
| Netlify | `@nitropack/netlify` | Otomatik detect |
| Cloudflare Workers | `@nitropack/cloudflare` | Edge runtime |
| Node.js | Default | Self-hosted |
| Bun | `@nitropack/bun` | Hizli |

## app.config.ts

```typescript
// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";

export default defineConfig({
  tsr: {
    appDirectory: "./src",
    autoCodeSplitting: true,
  },
  server: {
    // Hosting provider preset
    preset: "vercel", // "netlify" | "cloudflare-workers" | "node-server"
  },
});
```

## Vercel Deployment

```json
// vercel.json (genellikle gerekmez — otomatik detect)
{
  "framework": "vite"
}
```

```bash
# Build
pnpm build

# Vercel CLI
vercel deploy
```

## Cloudflare Workers

```typescript
// app.config.ts
export default defineConfig({
  server: {
    preset: "cloudflare-workers",
    rollupConfig: {
      external: ["node:async_hooks"],
    },
  },
});
```

## Node.js (Self-Hosted)

```bash
pnpm build
node .output/server/index.mjs
```

## Environment Variables Yonetimi

```bash
# Development
.env.local     # Gitignore'da — local secrets
.env           # Template — commit edilebilir

# Production (Vercel/Netlify dashboard'dan)
VITE_CONVEX_URL=https://project.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

## CI/CD — GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          
      - run: pnpm install --frozen-lockfile
      
      # Convex deploy
      - run: npx convex deploy
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
      
      # Frontend build
      - run: pnpm build
        env:
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
      
      # Deploy to Vercel
      - uses: vercel/action@v3
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Preview Deployments

Convex + Vercel ile preview deployments:

```bash
# Her PR icin Convex preview deployment
npx convex deploy --preview-name pr-123

# .env.preview
VITE_CONVEX_URL=https://project-pr-123.convex.cloud
```

## Production Checklist

- [ ] `VITE_CONVEX_URL` production URL
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` production key (`pk_live_...`)
- [ ] `CLERK_JWT_ISSUER_DOMAIN` production domain
- [ ] Convex `CLERK_JWT_ISSUER_DOMAIN` env var guncellendi
- [ ] `npx convex deploy` ile production deploy yapildi
- [ ] Error monitoring (Sentry vs.) kurulu
- [ ] Analytics (PostHog vs.) kurulu
