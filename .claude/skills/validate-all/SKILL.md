---
name: validate-all
description: Run full project validation (arch tests + dependency check + duplicates + typecheck)
---

Run the complete CherryJS validation pipeline:

1. `npm run test:arch` — All architectural tests must pass (backend layers, frontend naming, structural integrity, responsive scoring, tech adoption, code quality)
2. `npm run lint:deps` — dependency-cruiser must show 0 violations (cross-domain, circular, layer direction)
3. `npm run lint:duplicates` — jscpd duplication must be < 10%
4. `npm run typecheck` — TypeScript must compile with no errors

If any step fails, diagnose and fix before proceeding. Do NOT skip failing tests.

Quick single command: `npm run check`
