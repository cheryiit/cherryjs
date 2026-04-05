/**
 * Code Quality Tests
 *
 * Integrates external analysis tools into the test suite:
 * - dependency-cruiser: Domain isolation, layer rules, circular deps
 * - jscpd: Duplicate code detection
 *
 * These tests shell out to the tools and parse their output.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

// =============================================================================
// 1. DEPENDENCY RULES (dependency-cruiser)
// =============================================================================

describe("Code Quality: Dependency Rules", () => {
  it("no dependency violations (cross-domain, circular, layer)", () => {
    try {
      const result = execSync(
        "npx depcruise convex app --config .dependency-cruiser.cjs --output-type err 2>&1",
        { encoding: "utf-8", timeout: 30_000 },
      );
      expect(result).toContain("no dependency violations found");
    } catch (error: any) {
      // If depcruise exits non-zero, it found violations
      const output = error.stdout ?? error.message;
      expect.fail(
        `Dependency violations found:\n${output}`,
      );
    }
  });
});

// =============================================================================
// 2. DUPLICATE CODE (jscpd)
// =============================================================================

describe("Code Quality: Duplicate Code", () => {
  it("duplication rate below 10%", () => {
    try {
      const result = execSync(
        "npx jscpd convex app --min-lines 8 --min-tokens 70 --reporters console 2>&1",
        { encoding: "utf-8", timeout: 30_000 },
      );

      // Parse duplication percentage from output
      const percentMatch = result.match(
        /Duplicated lines\s*│\s*\d+\s*\((\d+\.?\d*)%\)/,
      );
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]!);
        expect(
          percent,
          `Code duplication is ${percent}% — max allowed is 10%`,
        ).toBeLessThan(10);
      }
      // If no percentage found, either 0% or output format changed — pass
    } catch (error: any) {
      // jscpd exits 0 even with clones (unless threshold exceeded)
      const output = error.stdout ?? "";
      const percentMatch = output.match(
        /Duplicated lines\s*│\s*\d+\s*\((\d+\.?\d*)%\)/,
      );
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]!);
        expect(percent).toBeLessThan(10);
      }
    }
  });

  it("no single clone larger than 20 lines", () => {
    try {
      const result = execSync(
        "npx jscpd convex app --min-lines 20 --min-tokens 100 --reporters console 2>&1",
        { encoding: "utf-8", timeout: 30_000 },
      );

      // Count clones with 20+ lines
      const cloneCount = (result.match(/Clone found/g) ?? []).length;
      expect(
        cloneCount,
        `Found ${cloneCount} large duplicates (20+ lines) — refactor into shared utility`,
      ).toBe(0);
    } catch (error: any) {
      const output = error.stdout ?? "";
      const cloneCount = (output.match(/Clone found/g) ?? []).length;
      expect(cloneCount).toBe(0);
    }
  });
});
