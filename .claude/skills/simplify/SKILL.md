---
name: simplify
description: Review changed code for reuse opportunities, quality issues, duplication, and boilerplate — then fix any issues found
---

Review and simplify the code in `$ARGUMENTS` (file path, directory, or "." for all staged changes).

## What to check

1. **Duplicate logic across files** — if the same 5+ lines appear in multiple places, extract to a shared helper in `lib/` (backend) or `app/lib/` (frontend).

2. **Oversized files** — channel max 200 lines, model max 300, business max 500. If over, split into smaller focused functions or extract to a sub-helper.

3. **Boilerplate reduction** — repeated arg validator patterns, repeated handler shapes, repeated import blocks. Use shared validators from `lib/validators.ts` or extract a domain-local `{domain}Validators.ts` if the pattern is domain-specific.

4. **Naming consistency** — verify camelCase domain filenames, `get*/list*/find*` model function names, `@admin` markers on admin endpoints.

5. **Dead code** — imports that aren't used, functions that aren't called, commented-out blocks.

6. **Anti-patterns our tests catch** — `.collect().length`, `Promise.all(ids.map(ctx.db.get))`, `fetch()` outside integration, `throw new Error()` instead of `errors.*`, raw `internalMutation` instead of `businessMutation`.

7. **Frontend patterns** — hardcoded colors (use semantic tokens), missing `cn()` for className merging, useState in route files (delegate to features).

## Steps

1. Read the target files/directory
2. Identify issues from the checklist above
3. Fix each issue in-place (or suggest extraction target)
4. Run `npm run test:arch` after each significant change
5. Run `npm run check` at the end to verify zero regressions

## Do NOT

- Add new features — only refactor existing code
- Change public API signatures (function names, args) without checking callers
- Remove `// cherry:allow` comments without understanding why they're there
- Touch `_generated/` or `node_modules/`
