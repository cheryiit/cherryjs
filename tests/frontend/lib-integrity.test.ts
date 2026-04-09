/**
 * Frontend lib/ and Styles Integrity Tests
 *
 * Ensures required frontend shared utilities and style files exist
 * with correct exports.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { APP, read } from "../helpers";

const LIB = join(APP, "lib");

// =============================================================================
// 1. LIB INTEGRITY
// =============================================================================

describe("Frontend: lib/ Integrity", () => {
  const REQUIRED_LIB_FILES = [
    "utils.ts",
    "auth-client.ts",
    "auth-server.ts",
    "config.ts",
    "convex.ts",
    "form.ts",
    "motion.ts",
    "seo.ts",
    "toast.ts",
    "table.ts",
    "virtual.ts",
    "pacer.ts",
    "store.ts",
  ];

  for (const file of REQUIRED_LIB_FILES) {
    it(`app/lib/${file} must exist`, () => {
      expect(existsSync(join(LIB, file))).toBe(true);
    });
  }

  it("app/lib/utils.ts: must export cn()", () => {
    const content = read(join(LIB, "utils.ts"));
    expect(content).toContain("export function cn");
  });
});

// =============================================================================
// 2. STYLES INTEGRITY
// =============================================================================

describe("Frontend: Styles Integrity", () => {
  it("globals.css must exist", () => {
    expect(
      existsSync(join(APP, "styles", "globals.css")),
    ).toBe(true);
  });

  it("globals.css: must import Tailwind", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain("tailwindcss");
  });

  it("globals.css: must define dark mode", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain(".dark");
  });

  it("globals.css: must define CSS variables (design tokens)", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain("--background");
    expect(content).toContain("--foreground");
    expect(content).toContain("--primary");
    expect(content).toContain("--radius");
  });
});
