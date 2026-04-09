/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── DOMAIN ISOLATION ──────────────────────────────────────────────────────
    // Domain A cannot import from Domain B's files directly
    {
      name: "no-cross-domain-import",
      severity: "error",
      comment: "Domains must communicate via internal API (ctx.runQuery/runMutation), not direct imports",
      from: { path: "^convex/apps/([^/]+)/" },
      to: {
        path: "^convex/apps/([^/]+)/",
        pathNot: "^convex/apps/$1/", // Same domain is OK
      },
    },

    // ── CORE INDEPENDENCE ─────────────────────────────────────────────────────
    // core/ cannot import from apps/
    {
      name: "no-core-depends-on-apps",
      severity: "error",
      comment: "Core infrastructure must not depend on business domains",
      from: { path: "^convex/core/" },
      to: { path: "^convex/apps/" },
    },

    // ── LIB INDEPENDENCE ──────────────────────────────────────────────────────
    // lib/ cannot import from apps/ or core/
    {
      name: "no-lib-depends-on-apps",
      severity: "error",
      comment: "Shared lib must not depend on business domains",
      from: { path: "^convex/lib/" },
      to: { path: "^convex/apps/" },
    },
    {
      name: "no-lib-depends-on-core",
      severity: "error",
      comment: "Shared lib must not depend on core modules",
      from: { path: "^convex/lib/" },
      to: { path: "^convex/core/" },
    },

    // ── LAYER RULES ───────────────────────────────────────────────────────────
    // channel cannot import business/integration directly (use internal API)
    {
      name: "no-channel-imports-business-file",
      severity: "warn",
      comment: "Channel should call business via ctx.runMutation/runQuery, not direct import",
      from: { path: "\\.channel\\.ts$" },
      to: { path: "\\.business\\.ts$" },
    },
    {
      name: "no-channel-imports-integration-file",
      severity: "error",
      comment: "Channel must not directly import integration files",
      from: { path: "\\.channel\\.ts$" },
      to: { path: "\\.integration\\.ts$" },
    },

    // model cannot import business/channel/integration
    {
      name: "no-model-imports-business",
      severity: "error",
      comment: "Model layer is pure DB — cannot depend on business logic",
      from: { path: "\\.model\\.ts$" },
      to: { path: "\\.(?:business|channel|integration)\\.ts$" },
    },

    // ── CIRCULAR DEPENDENCIES ─────────────────────────────────────────────────
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies break maintainability",
      from: {},
      to: { circular: true },
    },

    // ── FRONTEND RULES ────────────────────────────────────────────────────────
    // Frontend components cannot import from convex/ directly (except _generated/api)
    {
      name: "no-component-imports-convex-internals",
      severity: "warn",
      comment: "Components should use hooks, not import convex internals directly",
      from: { path: "^app/components/" },
      to: {
        path: "^convex/",
        pathNot: "^convex/_generated/api",
      },
    },

    // Route files should be thin — no heavy convex imports
    {
      name: "no-route-imports-convex-business",
      severity: "warn",
      comment: "Routes should delegate to features/hooks, not import convex business logic",
      from: { path: "^app/routes/" },
      to: { path: "^convex/(?!_generated)" },
    },
  ],

  options: {
    doNotFollow: {
      path: ["node_modules", "_generated", "dist", ".output"],
    },
    exclude: {
      path: [
        "node_modules",
        "_generated",
        "dist",
        ".output",
        "\\.gen\\.ts$", // TanStack Router auto-generated routeTree.gen.ts
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
