---
name: manage-convex-env
description: Inspect and manage Convex environment variables across dev and prod deployments via MCP server
---

Read or modify Convex environment variables. Use the Convex MCP server tools, not raw shell commands when possible.

## Available MCP Tools

- `mcp__convex__envList` — list all env vars on a deployment
- `mcp__convex__envGet` — read one env var by name
- `mcp__convex__envSet` — write/update an env var (dev only by default)
- `mcp__convex__envRemove` — delete an env var (dev only by default)
- `mcp__convex__status` — list configured deployments (dev/prod)
- `mcp__convex__tables` — list tables in the active deployment
- `mcp__convex__data` — read paginated rows from a table
- `mcp__convex__functionSpec` — list functions with arg/return types
- `mcp__convex__runOneoffQuery` — sandboxed read-only ad-hoc query
- `mcp__convex__logs` — tail function logs
- `mcp__convex__insights` — slow queries, errors

## Workflow

1. Identify the target deployment (dev or prod)
2. For **dev**: use MCP tools directly — they default to dev
3. For **prod read**: requires `--cautiously-allow-production-pii` flag in `.mcp.json`. If not set, use shell: `npx convex env list --prod`
4. For **prod write**: NEVER do this without explicit user approval. The MCP server denies prod writes unless `--dangerously-enable-production-deployments` is set in `.mcp.json` (it isn't, by default).

## Reference Templates

- `.env.example` — all required vars (committed template)
- `.env.dev.example` — dev deployment reference
- `.env.prod.example` — prod deployment reference (sacred)

## Bulk Apply From File (shell only — not via MCP)

```bash
# Apply all dev env vars at once
npx convex env set --from-file .env.dev

# Apply prod env vars (requires user approval, never autonomous)
npx convex env set --from-file .env.prod --prod
```

## Safety Rules

1. **Never write to prod env without explicit user confirmation in the same turn.**
2. **Never log or echo secrets** when reading them — describe what was found, not the value.
3. **Compare dev vs prod env var names** before deploying — missing vars in prod cause runtime crashes.
4. **Rotate `BETTER_AUTH_SECRET` independently** in dev and prod — never share.
5. **`POLAR_SERVER` must be `sandbox` in dev and `production` in prod** — verify before deploys.
6. **`RESEND_TEST_MODE=true` in dev** to avoid sending real emails to test addresses.

## Common Operations

### Compare dev and prod env var names
1. Call `mcp__convex__envList` for dev
2. Run `npx convex env list --prod` in shell
3. Diff the names — flag any mismatch to the user

### Add a new env var to both deployments
1. Confirm name and value with user
2. `mcp__convex__envSet` for dev
3. Tell user the exact `npx convex env set NAME value --prod` command for them to run manually
4. Update `.env.example`, `.env.dev.example`, `.env.prod.example`

### Inspect a table without reading data
- `mcp__convex__tables` — schema and indexes
- `mcp__convex__functionSpec` — what functions exist on each table
