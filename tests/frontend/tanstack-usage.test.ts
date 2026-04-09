/**
 * TanStack Ecosystem Usage Tests
 *
 * Enforces correct tool selection across the TanStack ecosystem.
 * The biggest risk: putting server data into a client store, creating
 * two sources of truth.
 */
import { describe, it, expect } from "vitest";
import { walkFiles, read, rel, APP } from "../helpers";
import { join, basename } from "path";

const STORE_FILES = [
  ...walkFiles(APP, ".store.ts"),
  // Also check anything that calls createCherryStore
];

const ALL_FRONTEND_FILES = [
  ...walkFiles(APP, ".ts"),
  ...walkFiles(APP, ".tsx"),
].filter(
  (f) =>
    !f.includes("node_modules") &&
    !f.endsWith(".gen.ts") &&
    !f.endsWith(".test.ts"),
);

// Files that actually create stores (callers of createCherryStore)
const STORE_USAGE_FILES = ALL_FRONTEND_FILES.filter((f) => {
  const content = read(f);
  return (
    content.includes("createCherryStore") &&
    !f.endsWith("store.ts") // exclude the wrapper itself
  );
});

// =============================================================================
// 1. STORE MUST NOT CONTAIN SERVER DATA
// =============================================================================

describe("TanStack: stores must not contain server data", () => {
  if (STORE_USAGE_FILES.length === 0) {
    it("skip: no stores defined yet", () => expect(true).toBe(true));
    return;
  }

  for (const file of STORE_USAGE_FILES) {
    const content = read(file);

    it(`${rel(file)}: store does not import Convex API`, () => {
      // A store file should never import from convex/_generated/api
      // (means it's storing server data — wrong abstraction)
      const importsConvexApi =
        /from\s+["'][^"']*convex\/_generated\/api["']/.test(content) ||
        /from\s+["']~\/?convex\/_generated\/api["']/.test(content);
      expect(
        importsConvexApi,
        `${rel(file)}: imports Convex API into a store. Server data belongs in useQuery, not a client store.`,
      ).toBe(false);
    });

    it(`${rel(file)}: store does not call useQuery / useMutation`, () => {
      // Stores are pure data — no React hooks inside them
      const hasHookCall =
        /\buseQuery\s*\(/.test(content) ||
        /\buseMutation\s*\(/.test(content) ||
        /\buseAction\s*\(/.test(content);
      expect(
        hasHookCall,
        `${rel(file)}: store calls Convex hooks. Stores must be React-hook-free.`,
      ).toBe(false);
    });

    it(`${rel(file)}: store does not fetch over network`, () => {
      // Stores must not contain side effects
      const hasFetch =
        /\bfetch\s*\(/.test(content) &&
        !content.includes("// cherry:allow");
      expect(
        hasFetch,
        `${rel(file)}: store calls fetch(). Stores must be pure client state.`,
      ).toBe(false);
    });
  }
});

// =============================================================================
// 2. STORE FILE NAMING — must end with .store.ts
// =============================================================================

describe("TanStack: store file naming", () => {
  if (STORE_USAGE_FILES.length === 0) {
    it("skip: no stores defined yet", () => expect(true).toBe(true));
    return;
  }

  for (const file of STORE_USAGE_FILES) {
    const name = basename(file);

    it(`${rel(file)}: must use .store.ts suffix or be in app/lib/`, () => {
      const isLib = file.includes("/app/lib/");
      const isStoreSuffixed = name.endsWith(".store.ts");
      expect(
        isLib || isStoreSuffixed,
        `${rel(file)}: stores must be named *.store.ts (e.g., wizard.store.ts) or live in app/lib/`,
      ).toBe(true);
    });
  }
});

// =============================================================================
// 3. NO RAW STORE INSTANTIATION (must use createCherryStore wrapper)
// =============================================================================

describe("TanStack: must use createCherryStore wrapper", () => {
  for (const file of ALL_FRONTEND_FILES) {
    if (file.endsWith("/app/lib/store.ts")) continue; // skip wrapper itself

    it(`${rel(file)}: no direct new Store() — use createCherryStore`, () => {
      const content = read(file);
      const hasRawStore =
        /\bnew\s+Store\s*</.test(content) &&
        !content.includes("// cherry:allow");
      expect(
        hasRawStore,
        `${rel(file)}: instantiates raw Store. Use createCherryStore() from app/lib/store.`,
      ).toBe(false);
    });
  }
});

// =============================================================================
// 4. NO COMPETING STATE LIBRARIES (Zustand, Jotai, Valtio, Redux)
// =============================================================================

describe("TanStack: no competing client state libraries", () => {
  const FORBIDDEN_LIBS = ["zustand", "jotai", "valtio", "redux", "@reduxjs"];

  for (const file of ALL_FRONTEND_FILES) {
    it(`${rel(file)}: no zustand/jotai/valtio/redux imports`, () => {
      const content = read(file);
      for (const lib of FORBIDDEN_LIBS) {
        const pattern = new RegExp(`from\\s+["']${lib.replace(/[/.]/g, "\\$&")}`);
        const found = pattern.test(content) && !content.includes("// cherry:allow");
        expect(
          found,
          `${rel(file)}: imports "${lib}". CherryJS uses TanStack Store. See .claude/rules/tanstack-usage.md`,
        ).toBe(false);
      }
    });
  }
});

// =============================================================================
// 5. STORE FILE LIVES IN APPROVED LOCATIONS
// =============================================================================

describe("TanStack: store file location", () => {
  if (STORE_USAGE_FILES.length === 0) {
    it("skip: no stores defined yet", () => expect(true).toBe(true));
    return;
  }

  for (const file of STORE_USAGE_FILES) {
    it(`${rel(file)}: lives in app/lib/ or app/features/`, () => {
      const isLib = file.includes("/app/lib/");
      const isFeature = file.includes("/app/features/");
      expect(
        isLib || isFeature,
        `${rel(file)}: stores must live in app/lib/ (app-wide) or app/features/{name}/ (feature-scoped)`,
      ).toBe(true);
    });
  }
});
