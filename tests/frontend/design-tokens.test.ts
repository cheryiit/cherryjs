/**
 * Design Token Enforcement Tests
 *
 * Ensures consistent color usage across the frontend:
 * - No arbitrary color values in className (bracket syntax with colors)
 * - No Tailwind default palette colors (red-500, blue-600, etc.)
 * - Light/dark mode token completeness
 * - All CSS variables properly mapped in @theme
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { APP, walkFiles, rel } from "../helpers";

const GLOBALS_CSS = join(APP, "styles", "globals.css");

// ── Helpers ──────────────────────────────────────────────────────────────────

function readGlobals(): string {
  return readFileSync(GLOBALS_CSS, "utf-8");
}

function extractCssVars(block: string): string[] {
  const vars: string[] = [];
  const matches = block.matchAll(/--([a-z][\w-]*)\s*:/g);
  for (const m of matches) {
    vars.push(m[1]!);
  }
  return vars;
}

function extractBlock(css: string, selector: string): string {
  const regex = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "g");
  const match = regex.exec(css);
  if (!match) return "";

  let depth = 0;
  let start = match.index + match[0].length;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      if (depth === 0) return css.slice(start, i);
      depth--;
    }
  }
  return "";
}

// ── Tailwind default palette colors that should NOT be used ──────────────────
// These are Tailwind's built-in color names — we use semantic tokens instead

const TAILWIND_PALETTE_PREFIXES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "zinc", "neutral", "stone",
];

// Build regex: bg-red-500, text-blue-600, border-slate-200, etc.
const PALETTE_COLOR_REGEX = new RegExp(
  `\\b(?:bg|text|border|ring|outline|shadow|from|via|to|divide|placeholder|fill|stroke)-(?:${TAILWIND_PALETTE_PREFIXES.join("|")})-\\d{2,3}\\b`,
);

// Arbitrary color bracket patterns
const ARBITRARY_COLOR_PATTERNS = [
  /\b(?:bg|text|border|ring|outline|fill|stroke)-\[#[0-9a-fA-F]/,       // bg-[#fff]
  /\b(?:bg|text|border|ring|outline|fill|stroke)-\[oklch\(/,             // bg-[oklch(...)]
  /\b(?:bg|text|border|ring|outline|fill|stroke)-\[rgb[a]?\(/,           // bg-[rgb(...)]
  /\b(?:bg|text|border|ring|outline|fill|stroke)-\[hsl[a]?\(/,           // bg-[hsl(...)]
  /\b(?:bg|text|border|ring|outline|fill|stroke)-\[color:/,              // bg-[color:...]
];

// =============================================================================
// 1. NO ARBITRARY COLOR VALUES IN CLASSNAME
// =============================================================================

describe("Design Tokens: 1. No Arbitrary Colors", () => {
  const allTsx = [
    ...walkFiles(join(APP, "components"), ".tsx"),
    ...walkFiles(join(APP, "features"), ".tsx"),
    ...walkFiles(join(APP, "routes"), ".tsx"),
  ];

  if (allTsx.length === 0) {
    it("skip: no tsx files", () => expect(true).toBe(true));
    return;
  }

  for (const file of allTsx) {
    it(`${rel(file)}: no arbitrary color values in className`, () => {
      const content = readFileSync(file, "utf-8");
      const violations: string[] = [];

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("// cherry:allow")) continue;
        if (line.trim().startsWith("//")) continue;

        // Check for arbitrary bracket colors
        for (const pattern of ARBITRARY_COLOR_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(
              `Line ${i + 1}: arbitrary color value — use semantic token (bg-primary, text-muted-foreground, etc.)`,
            );
            break;
          }
        }
      }

      expect(
        violations,
        violations.join("\n"),
      ).toHaveLength(0);
    });
  }
});

// =============================================================================
// 2. NO TAILWIND DEFAULT PALETTE COLORS
// =============================================================================

describe("Design Tokens: 2. No Tailwind Palette Colors", () => {
  const allTsx = [
    ...walkFiles(join(APP, "components"), ".tsx"),
    ...walkFiles(join(APP, "features"), ".tsx"),
    ...walkFiles(join(APP, "routes"), ".tsx"),
  ];

  if (allTsx.length === 0) {
    it("skip: no tsx files", () => expect(true).toBe(true));
    return;
  }

  for (const file of allTsx) {
    it(`${rel(file)}: no default Tailwind palette colors (use semantic tokens)`, () => {
      const content = readFileSync(file, "utf-8");
      const violations: string[] = [];

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("// cherry:allow")) continue;
        if (line.trim().startsWith("//")) continue;
        // Only check lines that have className or cn(
        if (!line.includes("className") && !line.includes("cn(")) continue;

        const match = line.match(PALETTE_COLOR_REGEX);
        if (match) {
          violations.push(
            `Line ${i + 1}: "${match[0]}" — use semantic token instead`,
          );
        }
      }

      expect(
        violations,
        violations.join("\n"),
      ).toHaveLength(0);
    });
  }
});

// =============================================================================
// 3. LIGHT/DARK MODE TOKEN COMPLETENESS
// =============================================================================

describe("Design Tokens: 3. Light/Dark Mode Completeness", () => {
  if (!existsSync(GLOBALS_CSS)) {
    it("skip: globals.css not found", () => expect(true).toBe(true));
    return;
  }

  const css = readGlobals();
  const rootBlock = extractBlock(css, ":root");
  const darkBlock = extractBlock(css, ".dark");

  const rootVars = extractCssVars(rootBlock);
  const darkVars = extractCssVars(darkBlock);

  // Exclude non-color vars that don't need dark mode counterpart
  const EXCLUDED_FROM_DARK = ["radius", "font-sans", "font-display", "font-mono"];

  it(":root and .dark must define the same tokens", () => {
    const missingInDark = rootVars.filter(
      (v) => !darkVars.includes(v) && !EXCLUDED_FROM_DARK.includes(v),
    );
    const missingInRoot = darkVars.filter(
      (v) => !rootVars.includes(v) && !EXCLUDED_FROM_DARK.includes(v),
    );

    const violations: string[] = [];
    for (const v of missingInDark) {
      violations.push(`--${v} defined in :root but missing in .dark`);
    }
    for (const v of missingInRoot) {
      violations.push(`--${v} defined in .dark but missing in :root`);
    }

    expect(violations, violations.join("\n")).toHaveLength(0);
  });
});

// =============================================================================
// 4. @THEME MAPPING COMPLETENESS
// =============================================================================

describe("Design Tokens: 4. @theme Mapping", () => {
  if (!existsSync(GLOBALS_CSS)) {
    it("skip: globals.css not found", () => expect(true).toBe(true));
    return;
  }

  const css = readGlobals();
  const rootBlock = extractBlock(css, ":root");
  const rootVars = extractCssVars(rootBlock);

  // Color-related vars that should be mapped in @theme
  const colorVars = rootVars.filter(
    (v) =>
      !["radius"].includes(v) &&
      !v.startsWith("font-"),
  );

  it("every color token in :root must be mapped in @theme", () => {
    const missingMappings: string[] = [];

    for (const v of colorVars) {
      // @theme should have --color-{name}: var(--{name}) for color tokens
      // or --radius-*: for radius tokens
      const isMapped =
        css.includes(`var(--${v})`) &&
        (css.includes(`--color-${v}`) || css.includes(`--radius-`));

      if (!isMapped) {
        missingMappings.push(`--${v} not mapped in @theme inline block`);
      }
    }

    expect(missingMappings, missingMappings.join("\n")).toHaveLength(0);
  });
});

// =============================================================================
// 5. NO INLINE STYLE COLOR VALUES
// =============================================================================

describe("Design Tokens: 5. No Inline Style Colors", () => {
  const allTsx = [
    ...walkFiles(join(APP, "components"), ".tsx"),
    ...walkFiles(join(APP, "features"), ".tsx"),
  ];

  if (allTsx.length === 0) {
    it("skip: no tsx files", () => expect(true).toBe(true));
    return;
  }

  for (const file of allTsx) {
    it(`${rel(file)}: no hardcoded color in inline styles`, () => {
      const content = readFileSync(file, "utf-8");
      const violations: string[] = [];

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("// cherry:allow")) continue;
        if (line.trim().startsWith("//")) continue;

        // Check for color/backgroundColor in style prop with hardcoded values
        if (
          /style=\{/.test(line) &&
          /(?:color|backgroundColor|borderColor)\s*:\s*["'](?:#|rgb|hsl|oklch)/.test(line)
        ) {
          violations.push(
            `Line ${i + 1}: hardcoded color in inline style — use CSS variable or Tailwind class`,
          );
        }
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
    });
  }
});

// =============================================================================
// 6. COMPONENT VARIANT CONSISTENCY
// =============================================================================

describe("Design Tokens: 6. CVA Variant Token Consistency", () => {
  const uiFiles = walkFiles(join(APP, "components", "ui"), ".tsx");

  if (uiFiles.length === 0) {
    it("skip: no UI components", () => expect(true).toBe(true));
    return;
  }

  for (const file of uiFiles) {
    const content = readFileSync(file, "utf-8");
    const name = basename(file, ".tsx");

    // Only check files that use CVA
    if (!content.includes("cva(")) continue;

    it(`${rel(file)}: CVA variants use only semantic tokens`, () => {
      const violations: string[] = [];
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("// cherry:allow")) continue;

        // Inside CVA definition, check for palette colors
        const match = line.match(PALETTE_COLOR_REGEX);
        if (match) {
          violations.push(
            `Line ${i + 1}: CVA variant uses palette color "${match[0]}" — use semantic token`,
          );
        }

        // Check for arbitrary bracket colors
        for (const pattern of ARBITRARY_COLOR_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(
              `Line ${i + 1}: CVA variant uses arbitrary color — use semantic token`,
            );
            break;
          }
        }
      }

      expect(violations, violations.join("\n")).toHaveLength(0);
    });
  }
});
