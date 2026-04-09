// @ts-nocheck — Template scaffolding (not spread into schema.ts).
/**
 * _template domain schema — COPY THIS when scaffolding a new domain.
 *
 * Steps:
 * 1. Copy `convex/apps/_template/` to `convex/apps/{yourDomain}/`
 * 2. Rename every file: `_template{Layer}.ts` → `{yourDomain}{Layer}.ts`
 * 3. Find-replace `_template` → `{yourDomain}` in all file contents
 * 4. Define your real tables + fields below
 * 5. Add `import { {yourDomain}Tables } from "./apps/{yourDomain}/{yourDomain}Schema"`
 *    to `convex/schema.ts` and spread it into `defineSchema({ ... })`
 * 6. Run `npm run test:arch` — fix any violations
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const _templateFields = {
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
};

export const _templateTables = {
  _templateItems: defineTable(_templateFields)
    .index("by_status", ["status", "createdAt"]),
};
