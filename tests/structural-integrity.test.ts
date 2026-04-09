/**
 * Structural Integrity Tests
 *
 * Enforces WHERE files can exist. The architecture tests check naming and content;
 * these tests check that no file exists outside the approved directory structure.
 *
 * Think of this as a "filesystem firewall" — only whitelisted locations allowed.
 */
import { describe, it, expect } from "vitest";
import {
  readdirSync,
  statSync,
  existsSync,
} from "fs";
import { join, basename } from "path";
import { ROOT, CONVEX, APP, walkFiles, getDirs, rel, read } from "./helpers";

// =============================================================================
// 0. CONVEX MULTI-DOT FILE NAMING (CRITICAL)
// =============================================================================
//
// Convex's bundler silently skips files whose basename contains more than one
// period (see node_modules/convex/dist/esm/bundler/index.js). For example,
// `users.business.ts` is NOT pushed to the deployment — it's invisible.
//
// This means the old `{domain}.{layer}.ts` convention is incompatible with
// Convex itself. The only allowed pattern is camelCase: `usersBusiness.ts`,
// `parameterModel.ts`, `coreSchema.ts`, etc.
//
// `*.test.ts` is the one exception (Vitest uses it; Convex skips test files).

describe("Structural: Convex multi-dot file names forbidden", () => {
  // Convex's own special config files are not bundled as user modules and
  // therefore exempt from the single-dot rule.
  const CONVEX_SPECIAL_FILES = new Set([
    "convex.config.ts",
    "auth.config.ts",
  ]);

  const allConvexFiles = walkFiles(CONVEX, ".ts").filter(
    (f) => !f.includes("_generated") && !f.includes("node_modules"),
  );

  for (const file of allConvexFiles) {
    const name = basename(file);
    if (CONVEX_SPECIAL_FILES.has(name)) continue;

    // Allow exactly one of: ".ts", ".test.ts" (vitest convention)
    const dotCount = (name.match(/\./g) ?? []).length;
    const isVitestFile = name.endsWith(".test.ts");
    const allowed = dotCount === 1 || (isVitestFile && dotCount === 2);

    it(`${rel(file)}: single dot in basename (Convex bundler requirement)`, () => {
      expect(
        allowed,
        `${name}: contains ${dotCount} dots — Convex silently skips files with multiple dots in the basename. Use camelCase like "usersBusiness.ts" instead of "users.business.ts".`,
      ).toBe(true);
    });
  }
});

// =============================================================================
// 1. CONVEX ROOT — Only approved files at root level
// =============================================================================

describe("Structural: convex/ root files", () => {
  const APPROVED_ROOT_FILES = [
    "schema.ts",
    "convex.config.ts",
    "triggers.ts",
    "http.ts",
    "auth.ts",
    "auth.config.ts",
    // _generated/ is auto-generated, excluded from check
  ];

  const rootFiles = existsSync(CONVEX)
    ? readdirSync(CONVEX).filter((f) => {
        const full = join(CONVEX, f);
        return statSync(full).isFile() && f.endsWith(".ts");
      })
    : [];

  for (const file of rootFiles) {
    it(`convex/${file}: approved root file`, () => {
      expect(
        APPROVED_ROOT_FILES,
        `convex/${file} is not an approved root file. Approved: ${APPROVED_ROOT_FILES.join(", ")}`,
      ).toContain(file);
    });
  }

  // Only approved directories at convex/ root
  const APPROVED_ROOT_DIRS = ["lib", "core", "apps", "_generated", "package.json"];
  const rootDirs = getDirs(CONVEX);

  for (const dir of rootDirs) {
    if (dir === "_generated" || dir === "node_modules") continue;

    it(`convex/${dir}/: approved directory`, () => {
      expect(
        ["lib", "core", "apps"],
        `convex/${dir}/ is not an approved directory. Approved: lib/, core/, apps/`,
      ).toContain(dir);
    });
  }
});

// =============================================================================
// 2. LIB — Only approved modules
// =============================================================================

describe("Structural: convex/lib/ files", () => {
  const APPROVED_LIB_FILES = [
    "aggregate.ts",
    "audit.ts",
    "cors.ts",
    "email.ts",
    "errors.ts",
    "filter.ts",
    "functions.ts",
    "migrations.ts",
    "permissions.ts",
    "polar.ts",
    "rateLimiter.ts",
    "relationships.ts",
    "requestContext.ts",
    "retrier.ts",
    "rls.ts",
    "search.ts",
    "sessions.ts",
    "settings.ts",
    "storage.ts",
    "validators.ts",
    "workflow.ts",
  ];

  const libDir = join(CONVEX, "lib");
  if (!existsSync(libDir)) return;

  const libFiles = readdirSync(libDir).filter((f) => f.endsWith(".ts"));

  for (const file of libFiles) {
    it(`lib/${file}: approved module`, () => {
      expect(
        APPROVED_LIB_FILES,
        `lib/${file} is not an approved lib module. Add it to APPROVED_LIB_FILES if intentional.`,
      ).toContain(file);
    });
  }

  it("lib/: no subdirectories", () => {
    const subdirs = getDirs(libDir);
    expect(
      subdirs,
      `lib/ should be flat — found subdirectories: ${subdirs.join(", ")}`,
    ).toHaveLength(0);
  });
});

// =============================================================================
// 3. CORE — Only approved sub-modules
// =============================================================================

describe("Structural: convex/core/ modules", () => {
  const APPROVED_CORE_MODULES = [
    "audit",
    "content",
    "parameter",
    "schedule",
    "webhook",
  ];

  const coreDir = join(CONVEX, "core");
  if (!existsSync(coreDir)) return;

  const coreDirs = getDirs(coreDir);

  for (const dir of coreDirs) {
    it(`core/${dir}/: approved core module`, () => {
      expect(
        APPROVED_CORE_MODULES,
        `core/${dir}/ is not an approved core module. Approved: ${APPROVED_CORE_MODULES.join(", ")}`,
      ).toContain(dir);
    });
  }

  // core.schema.ts is the only approved root file in core/
  const coreRootFiles = readdirSync(coreDir).filter((f) =>
    statSync(join(coreDir, f)).isFile() && f.endsWith(".ts"),
  );

  for (const file of coreRootFiles) {
    it(`core/${file}: must be coreSchema.ts`, () => {
      expect(
        file,
        `core/${file} — only coreSchema.ts allowed at core/ root`,
      ).toBe("coreSchema.ts");
    });
  }

  // Each core module must follow naming: {module}{Layer}.ts (camelCase, single dot for extension)
  for (const mod of APPROVED_CORE_MODULES) {
    const modDir = join(coreDir, mod);
    if (!existsSync(modDir)) continue;

    const modFiles = readdirSync(modDir).filter((f) => f.endsWith(".ts"));
    const APPROVED_SUFFIXES = [
      "Model.ts",
      "Business.ts",
      "Channel.ts",
      "Integration.ts",
      "Workflow.ts",
      "Schedule.ts",
      "Batch.ts",
      "Middleware.ts",
      ".test.ts",
    ];

    for (const file of modFiles) {
      it(`core/${mod}/${file}: correct naming`, () => {
        const startsWithMod = file.startsWith(mod);
        const hasApprovedSuffix = APPROVED_SUFFIXES.some((s) =>
          file.endsWith(s),
        );
        expect(
          startsWithMod && hasApprovedSuffix,
          `core/${mod}/${file} — must be named ${mod}{Layer}.ts (camelCase)`,
        ).toBe(true);
      });
    }

    it(`core/${mod}/: no subdirectories`, () => {
      const subdirs = getDirs(modDir);
      expect(subdirs).toHaveLength(0);
    });
  }
});

// =============================================================================
// 4. APPS — Domain structure enforcement
// =============================================================================

describe("Structural: convex/apps/ domains", () => {
  const appsDir = join(CONVEX, "apps");
  if (!existsSync(appsDir)) return;

  // No loose files in apps/ root
  const looseFiles = readdirSync(appsDir).filter((f) =>
    statSync(join(appsDir, f)).isFile(),
  );

  it("apps/: no loose files (only domain directories)", () => {
    expect(
      looseFiles.map((f) => `apps/${f}`),
      "Loose files found in apps/ — must be inside a domain directory",
    ).toHaveLength(0);
  });

  const domains = getDirs(appsDir);

  for (const domain of domains) {
    const domainDir = join(appsDir, domain);

    // No subdirectories inside domain
    it(`apps/${domain}/: no subdirectories (flat structure)`, () => {
      const subdirs = getDirs(domainDir);
      expect(
        subdirs.map((d) => `apps/${domain}/${d}/`),
        `Subdirectories found — domain files must be flat: ${domain}/${domain}{Layer}.ts`,
      ).toHaveLength(0);
    });

    // All files must start with domain name
    const domainFiles = readdirSync(domainDir).filter(
      (f) => f.endsWith(".ts") && statSync(join(domainDir, f)).isFile(),
    );

    for (const file of domainFiles) {
      it(`apps/${domain}/${file}: starts with "${domain}"`, () => {
        expect(
          file.startsWith(domain),
          `apps/${domain}/${file} — must start with "${domain}" (camelCase: ${domain}{Layer}.ts)`,
        ).toBe(true);
      });
    }
  }
});

// =============================================================================
// 5. CROSS-DOMAIN TABLE ACCESS — Schema-aware enforcement
// =============================================================================

describe("Structural: cross-domain table access", () => {
  const appsDir = join(CONVEX, "apps");
  if (!existsSync(appsDir)) return;

  // Build table → domain ownership map from schema files
  const tableOwnership: Record<string, string> = {};
  const domains = getDirs(appsDir);

  for (const domain of domains) {
    const schemaFile = join(appsDir, domain, `${domain}Schema.ts`);
    if (!existsSync(schemaFile)) continue;

    const content = read(schemaFile);
    // Extract table names from defineTable() or object keys in {domain}Tables
    const tableMatches = content.matchAll(
      /(\w+)\s*:\s*defineTable\(/g,
    );
    for (const match of tableMatches) {
      tableOwnership[match[1]!] = domain;
    }
  }

  // Also add core tables
  const coreSchemaFile = join(CONVEX, "core", "coreSchema.ts");
  if (existsSync(coreSchemaFile)) {
    const content = read(coreSchemaFile);
    const tableMatches = content.matchAll(
      /(\w+)\s*:\s*defineTable\(/g,
    );
    for (const match of tableMatches) {
      tableOwnership[match[1]!] = "__core__";
    }
  }

  // Check each domain's business files for cross-domain table access
  for (const domain of domains) {
    const businessFiles = walkFiles(join(appsDir, domain), ".ts").filter(
      (f) =>
        (f.endsWith("Business.ts") || f.endsWith("Channel.ts")) &&
        !f.endsWith(".test.ts"),
    );

    for (const file of businessFiles) {
      it(`${rel(file)}: no cross-domain table access`, () => {
        const content = read(file);
        const violations: string[] = [];

        // Find ctx.db.query("tableName") and ctx.db.insert("tableName") patterns
        const tableAccesses = content.matchAll(
          /ctx\.db\.(?:query|get|insert|patch|delete|replace)\s*\(\s*["'](\w+)["']/g,
        );

        for (const match of tableAccesses) {
          const tableName = match[1]!;
          const owner = tableOwnership[tableName];

          if (!owner) continue; // Unknown table — skip (might be in core)

          // Core tables are accessible by everyone
          if (owner === "__core__") continue;

          // Same domain — OK
          if (owner === domain) continue;

          // Different domain — violation
          violations.push(
            `Accessing "${tableName}" (owned by "${owner}") — use internal API instead of direct DB access`,
          );
        }

        expect(
          violations,
          violations.join("\n"),
        ).toHaveLength(0);
      });
    }
  }
});

// =============================================================================
// 6. SCHEMA AGGREGATOR COMPLETENESS
// =============================================================================

describe("Structural: schema aggregator completeness", () => {
  const schemaFile = join(CONVEX, "schema.ts");
  if (!existsSync(schemaFile)) return;

  const schemaContent = read(schemaFile);
  const appsDir = join(CONVEX, "apps");
  const domains = getDirs(appsDir);

  // Every domain with a {domain}Schema.ts must be in schema.ts
  for (const domain of domains) {
    const domainSchema = join(appsDir, domain, `${domain}Schema.ts`);
    if (!existsSync(domainSchema)) continue;

    it(`schema.ts imports ${domain}Tables`, () => {
      expect(
        schemaContent.includes(`${domain}Tables`),
        `schema.ts does not spread ...${domain}Tables — domain "${domain}" data will not be registered`,
      ).toBe(true);
    });
  }

  // core.schema.ts must be imported
  it("schema.ts imports coreTables", () => {
    expect(schemaContent).toContain("coreTables");
  });

  // Schema must NOT contain defineTable directly
  it("schema.ts: no inline defineTable()", () => {
    expect(schemaContent).not.toMatch(/defineTable\s*\(/);
  });
});

// =============================================================================
// 7. FRONTEND STRUCTURAL INTEGRITY
// =============================================================================

describe("Structural: app/ directory", () => {
  const APPROVED_APP_DIRS = [
    "components",
    "features",
    "lib",
    "routes",
    "styles",
    "contexts",
  ];

  const appDirs = getDirs(APP);

  for (const dir of appDirs) {
    it(`app/${dir}/: approved directory`, () => {
      expect(
        APPROVED_APP_DIRS,
        `app/${dir}/ is not approved. Approved: ${APPROVED_APP_DIRS.join(", ")}`,
      ).toContain(dir);
    });
  }

  // Approved root files in app/
  const APPROVED_APP_ROOT = [
    "client.tsx",
    "server.tsx",
    "router.tsx",
    "routeTree.gen.ts",
    "vite-env.d.ts",
  ];

  const appRootFiles = existsSync(APP)
    ? readdirSync(APP).filter((f) => {
        const full = join(APP, f);
        return statSync(full).isFile() && (f.endsWith(".ts") || f.endsWith(".tsx"));
      })
    : [];

  for (const file of appRootFiles) {
    it(`app/${file}: approved root file`, () => {
      expect(
        APPROVED_APP_ROOT,
        `app/${file} is not an approved app root file.`,
      ).toContain(file);
    });
  }
});

// =============================================================================
// 8. COMPONENTS DIRECTORY STRUCTURE
// =============================================================================

describe("Structural: app/components/ directory", () => {
  const APPROVED_COMPONENT_DIRS = [
    "ui",        // Base UI primitives (shadcn-style)
    "layout",    // Layout components (Header, Footer, Sidebar)
    "common",    // Shared across features
  ];

  const componentsDir = join(APP, "components");
  if (!existsSync(componentsDir)) return;

  const componentDirs = getDirs(componentsDir);

  for (const dir of componentDirs) {
    it(`components/${dir}/: approved subdirectory`, () => {
      expect(
        APPROVED_COMPONENT_DIRS,
        `components/${dir}/ is not approved. Approved: ${APPROVED_COMPONENT_DIRS.join(", ")}. Feature-specific components should go in features/{feature}/components/`,
      ).toContain(dir);
    });
  }

  // Root files in components/ must be providers or wrappers
  const rootComponentFiles = readdirSync(componentsDir).filter(
    (f) => statSync(join(componentsDir, f)).isFile() && f.endsWith(".tsx"),
  );

  for (const file of rootComponentFiles) {
    it(`components/${file}: must be a provider or wrapper`, () => {
      const name = basename(file, ".tsx");
      const isProvider = name.includes("provider") || name.includes("wrapper");
      expect(
        isProvider,
        `components/${file} — only providers/wrappers at components/ root. UI components go in components/ui/, feature components in features/{feature}/components/`,
      ).toBe(true);
    });
  }
});
