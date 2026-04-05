/**
 * Responsive Readiness Scoring System
 *
 * Static analysis that scores components A-F for responsive design.
 * No browser needed — analyzes className strings and inline styles.
 *
 * Viewport coverage: 360px (Galaxy S) → 3840px (4K)
 * Tailwind breakpoints: base(0) / sm(640) / md(768) / lg(1024) / xl(1280) / 2xl(1536)
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, basename } from "path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const COMPONENTS = join(APP, "components");
const ROUTES = join(APP, "routes");

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkFiles(dir: string, ext?: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full, ext));
    } else if (!ext || full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function rel(path: string): string {
  return relative(ROOT, path);
}

// ── Viewport Matrix ───────────────────────────────────────────────────────────

const VIEWPORTS = {
  "iPhone SE": 375,
  "iPhone 14": 390,
  "iPhone 14 Pro Max": 430,
  "Galaxy S21": 360,
  "Pixel 7": 412,
  "iPad Mini": 768,
  "iPad Air": 820,
  "iPad Pro 11": 834,
  "iPad Pro 12.9": 1024,
  "MacBook Air": 1280,
  "Laptop 1366": 1366,
  "Desktop 1440": 1440,
  "Full HD": 1920,
  "QHD": 2560,
  "4K": 3840,
} as const;

const MOBILE_MAX = 640;
const SMALLEST_PHONE = 360;

// ── Allowlist ─────────────────────────────────────────────────────────────────
// Patterns that are legitimately fixed-size

const FIXED_SIZE_ALLOWLIST = [
  /icon/i,
  /logo/i,
  /avatar/i,
  /spinner/i,
  /badge/i,
  /separator/i,
  /divider/i,
];

function isAllowlisted(filePath: string): boolean {
  const name = basename(filePath);
  return FIXED_SIZE_ALLOWLIST.some((p) => p.test(name));
}

// ── className Extractor ───────────────────────────────────────────────────────

function extractClassStrings(content: string): Array<{ line: number; classes: string }> {
  const results: Array<{ line: number; classes: string }> = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip comments
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    // Match className="..." and cn("...", "...")
    const classNameMatches = line.matchAll(/className=["']([^"']+)["']/g);
    for (const match of classNameMatches) {
      results.push({ line: i + 1, classes: match[1]! });
    }

    // Match cn(...) calls — extract string arguments
    const cnMatches = line.matchAll(/cn\(([^)]+)\)/g);
    for (const match of cnMatches) {
      const inner = match[1]!;
      const stringArgs = inner.matchAll(/["']([^"']+)["']/g);
      for (const strMatch of stringArgs) {
        results.push({ line: i + 1, classes: strMatch[1]! });
      }
    }
  }

  return results;
}

// ── Responsive Rules ──────────────────────────────────────────────────────────

type Severity = "high" | "medium" | "low";

interface Violation {
  severity: Severity;
  line: number;
  message: string;
  rule: string;
}

function checkResponsiveness(
  filePath: string,
  content: string,
): { violations: Violation[]; positiveSignals: string[] } {
  const violations: Violation[] = [];
  const positiveSignals: string[] = [];
  const classEntries = extractClassStrings(content);

  // Track file-level positive signals
  if (/\b(?:sm|md|lg|xl|2xl):/.test(content)) {
    positiveSignals.push("Uses responsive breakpoints");
  }
  if (/\b(?:w-full|w-auto|flex-1|grow|shrink)\b/.test(content)) {
    positiveSignals.push("Uses fluid sizing");
  }
  if (/\b(?:container|mx-auto)\b/.test(content)) {
    positiveSignals.push("Uses container centering");
  }
  if (/\bmin-w-0\b/.test(content)) {
    positiveSignals.push("Uses flex overflow fix (min-w-0)");
  }
  if (/\bclamp\(/.test(content)) {
    positiveSignals.push("Uses clamp() for fluid values");
  }

  for (const { line, classes } of classEntries) {
    // ── HIGH CONFIDENCE RULES ─────────────────────────────────────────────

    // Rule 1: Fixed width >= 400px without responsive variant
    const fixedWidths = classes.matchAll(/\bw-\[(\d+)px\]/g);
    for (const match of fixedWidths) {
      const px = parseInt(match[1]!, 10);
      if (px >= 400 && !/\b(?:sm|md|lg|xl|2xl):w-/.test(classes)) {
        violations.push({
          severity: "high",
          line,
          message: `Fixed width w-[${px}px] exceeds mobile viewport (${SMALLEST_PHONE}px) without responsive variant`,
          rule: "fixed-large-width",
        });
      }
    }

    // Rule 2: grid-cols-3+ without responsive grid cols
    const gridCols = classes.match(/\bgrid-cols-(\d+)/);
    if (gridCols) {
      const cols = parseInt(gridCols[1]!, 10);
      if (cols >= 3 && !/\b(?:sm|md|lg|xl|2xl):grid-cols-/.test(classes)) {
        violations.push({
          severity: "high",
          line,
          message: `grid-cols-${cols} without responsive column fallback — will crush on mobile`,
          rule: "grid-no-responsive",
        });
      }
    }

    // Rule 3: Table without overflow wrapper (file-level check)
    if (classes.includes("table") && !content.includes("overflow-x-auto") && !content.includes("overflow-auto")) {
      // Only flag once per file
      if (!violations.some((v) => v.rule === "table-no-overflow")) {
        violations.push({
          severity: "high",
          line,
          message: "Table layout without overflow-x-auto wrapper",
          rule: "table-no-overflow",
        });
      }
    }

    // ── MEDIUM CONFIDENCE RULES ───────────────────────────────────────────

    // Rule 4: Large text without responsive variant
    const largeText = classes.match(
      /\btext-(4xl|5xl|6xl|7xl|8xl|9xl)/,
    );
    if (largeText && !/\b(?:sm|md|lg|xl|2xl):text-/.test(classes)) {
      violations.push({
        severity: "medium",
        line,
        message: `text-${largeText[1]} without responsive text size — may overflow on small screens`,
        rule: "large-text-no-responsive",
      });
    }

    // Rule 5: Large padding without responsive
    const largePadding = classes.match(
      /\bp[xy]-(1[6-9]|[2-9]\d)/,
    );
    if (largePadding && !/\b(?:sm|md|lg|xl|2xl):p[xy]-/.test(classes)) {
      violations.push({
        severity: "medium",
        line,
        message: `Large padding px/py-${largePadding[1]} without responsive variant`,
        rule: "large-padding-no-responsive",
      });
    }

    // Rule 6: whitespace-nowrap without overflow handling
    if (
      classes.includes("whitespace-nowrap") &&
      !classes.includes("truncate") &&
      !classes.includes("text-ellipsis") &&
      !classes.includes("overflow-")
    ) {
      violations.push({
        severity: "medium",
        line,
        message: "whitespace-nowrap without truncate/ellipsis/overflow handling",
        rule: "nowrap-no-overflow",
      });
    }

    // Rule 7: flex-row with no flex-wrap (medium — may be intentional)
    if (
      classes.includes("flex-row") &&
      !classes.includes("flex-wrap") &&
      !classes.includes("overflow-")
    ) {
      // Only medium severity — many flex-row layouts are fine
      violations.push({
        severity: "low",
        line,
        message: "flex-row without flex-wrap — verify it fits on mobile",
        rule: "flex-row-no-wrap",
      });
    }

    // Rule 8: Absolute positioning with large pixel offsets
    const absOffsets = classes.matchAll(
      /\b(?:left|right|top|bottom)-\[(\d+)px\]/g,
    );
    for (const match of absOffsets) {
      const px = parseInt(match[1]!, 10);
      if (px >= 200) {
        violations.push({
          severity: "medium",
          line,
          message: `Fixed positioning offset ${match[0]} (${px}px) — may misplace on different viewports`,
          rule: "absolute-fixed-offset",
        });
      }
    }
  }

  // ── INLINE STYLE CHECKS ────────────────────────────────────────────────

  const inlineStyleWidths = content.matchAll(
    /style=\{\{[^}]*(?:width|minWidth)\s*:\s*['"]?(\d+)(?:px)?['"]?/g,
  );
  for (const match of inlineStyleWidths) {
    const px = parseInt(match[1]!, 10);
    if (px >= 400) {
      violations.push({
        severity: "high",
        line: 0,
        message: `Inline style fixed width ${px}px — use Tailwind responsive classes instead`,
        rule: "inline-fixed-width",
      });
    }
  }

  return { violations, positiveSignals };
}

// ── Scoring Algorithm ─────────────────────────────────────────────────────────

type Grade = "A" | "B" | "C" | "D" | "F";

interface ResponsivenessScore {
  score: number;
  grade: Grade;
  violations: Violation[];
  positiveSignals: string[];
}

function scoreComponent(filePath: string, content: string): ResponsivenessScore {
  const { violations, positiveSignals } = checkResponsiveness(
    filePath,
    content,
  );

  let score = 70; // Benefit of the doubt

  // Deductions
  const highViolations = violations.filter((v) => v.severity === "high");
  const mediumViolations = violations.filter((v) => v.severity === "medium");
  const lowViolations = violations.filter((v) => v.severity === "low");

  score -= Math.min(highViolations.length * 15, 60);
  score -= Math.min(mediumViolations.length * 5, 20);
  score -= Math.min(lowViolations.length * 2, 10);

  // Bonuses
  if (positiveSignals.includes("Uses responsive breakpoints")) score += 10;
  if (positiveSignals.includes("Uses fluid sizing")) score += 5;
  if (positiveSignals.includes("Uses container centering")) score += 5;
  if (positiveSignals.includes("Uses flex overflow fix (min-w-0)")) score += 5;
  if (positiveSignals.includes("Uses clamp() for fluid values")) score += 5;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Grade
  let grade: Grade;
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { score, grade, violations, positiveSignals };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Responsive Readiness: UI Components", () => {
  const uiFiles = walkFiles(join(COMPONENTS, "ui"), ".tsx");

  if (uiFiles.length === 0) {
    it("skip: no UI components", () => expect(true).toBe(true));
    return;
  }

  for (const file of uiFiles) {
    const name = rel(file);
    const content = readFileSync(file, "utf-8");
    const result = scoreComponent(file, content);

    it(`${name}: score >= 60 (grade C+) [${result.grade}: ${result.score}]`, () => {
      if (isAllowlisted(file)) return; // Fixed-size components are exempt

      if (result.score < 60) {
        const report = [
          `Score: ${result.score}/100 (${result.grade})`,
          "",
          "Violations:",
          ...result.violations.map(
            (v) => `  [${v.severity.toUpperCase()}] Line ${v.line}: ${v.message}`,
          ),
          "",
          "Positive signals:",
          ...result.positiveSignals.map((s) => `  + ${s}`),
        ].join("\n");
        expect(result.score, report).toBeGreaterThanOrEqual(60);
      }
    });

    it(`${name}: no high-severity violations`, () => {
      if (isAllowlisted(file)) return;

      const highViolations = result.violations.filter(
        (v) => v.severity === "high",
      );
      if (highViolations.length > 0) {
        const report = highViolations
          .map((v) => `Line ${v.line}: ${v.message}`)
          .join("\n");
        expect(highViolations, report).toHaveLength(0);
      }
    });
  }
});

describe("Responsive Readiness: Feature Components", () => {
  const featureFiles = walkFiles(join(APP, "features"), ".tsx");

  if (featureFiles.length === 0) {
    it("skip: no feature components", () => expect(true).toBe(true));
    return;
  }

  for (const file of featureFiles) {
    const content = readFileSync(file, "utf-8");
    const result = scoreComponent(file, content);

    it(`${rel(file)}: score >= 50 (grade D+)`, () => {
      expect(result.score).toBeGreaterThanOrEqual(50);
    });
  }
});

describe("Responsive Readiness: Route Pages", () => {
  const routeFiles = walkFiles(ROUTES, ".tsx").filter(
    (f) => !basename(f).startsWith("__"),
  );

  if (routeFiles.length === 0) {
    it("skip: no route files", () => expect(true).toBe(true));
    return;
  }

  for (const file of routeFiles) {
    const content = readFileSync(file, "utf-8");
    const result = scoreComponent(file, content);

    it(`${rel(file)}: score >= 60 (grade C+) [${result.grade}: ${result.score}]`, () => {
      if (result.score < 60) {
        const report = result.violations
          .map((v) => `  [${v.severity}] ${v.message}`)
          .join("\n");
        expect(result.score, report).toBeGreaterThanOrEqual(60);
      }
    });
  }
});

describe("Responsive Anti-Pattern: Hardcoded Hex Colors in className", () => {
  const allTsx = [
    ...walkFiles(join(COMPONENTS, "ui"), ".tsx"),
    ...walkFiles(join(APP, "features"), ".tsx"),
  ];

  for (const file of allTsx) {
    it(`${rel(file)}: no hardcoded hex in className`, () => {
      const content = readFileSync(file, "utf-8");
      const hasHex = content
        .split("\n")
        .some(
          (l) =>
            l.includes("className") &&
            /#[0-9a-fA-F]{3,8}/.test(l) &&
            !l.includes("// cherry:allow") &&
            !l.includes("// responsive-ok"),
        );
      expect(hasHex).toBe(false);
    });
  }
});
