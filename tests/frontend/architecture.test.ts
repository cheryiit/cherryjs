/**
 * Frontend Architecture Tests
 *
 * UI component naming, line limits, export rules, responsive design patterns,
 * route rules, features structure, import rules, and Tailwind patterns.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { APP, walkFiles, read, lineCount, rel } from "../helpers";

const COMPONENTS = join(APP, "components");
const UI = join(COMPONENTS, "ui");
const FEATURES = join(APP, "features");
const ROUTES = join(APP, "routes");

// ── Component Type Registry ──────────────────────────────────────────────────

const COMPONENT_TYPES: Record<string, { maxLines: number; description: string }> = {
  // Layout
  Layout: { maxLines: 150, description: "Page layouts, grid systems" },
  Container: { maxLines: 80, description: "Wrapper containers" },
  Section: { maxLines: 100, description: "Page sections" },
  Grid: { maxLines: 100, description: "Grid layout primitives" },
  Stack: { maxLines: 60, description: "Flex stack components" },
  Sidebar: { maxLines: 200, description: "Sidebar navigation" },
  // Navigation
  Navbar: { maxLines: 150, description: "Top navigation bar" },
  Nav: { maxLines: 120, description: "Navigation component" },
  Breadcrumb: { maxLines: 80, description: "Breadcrumb navigation" },
  Pagination: { maxLines: 100, description: "Pagination controls" },
  Tab: { maxLines: 100, description: "Tab navigation" },
  Menu: { maxLines: 120, description: "Menu / dropdown menu" },
  // Data Display
  Card: { maxLines: 120, description: "Card containers" },
  Table: { maxLines: 200, description: "Data tables" },
  List: { maxLines: 120, description: "List components" },
  Badge: { maxLines: 60, description: "Status badges" },
  Avatar: { maxLines: 60, description: "User avatars" },
  Stat: { maxLines: 80, description: "Statistic displays" },
  Timeline: { maxLines: 150, description: "Timeline components" },
  Chart: { maxLines: 200, description: "Data visualization" },
  Empty: { maxLines: 60, description: "Empty state components" },
  Skeleton: { maxLines: 60, description: "Loading skeletons" },
  // Form
  Form: { maxLines: 200, description: "Form containers" },
  Input: { maxLines: 80, description: "Text inputs" },
  Select: { maxLines: 120, description: "Select / dropdown" },
  Checkbox: { maxLines: 60, description: "Checkboxes" },
  Radio: { maxLines: 80, description: "Radio buttons" },
  Switch: { maxLines: 60, description: "Toggle switches" },
  Slider: { maxLines: 80, description: "Range sliders" },
  Textarea: { maxLines: 60, description: "Multi-line text input" },
  DatePicker: { maxLines: 150, description: "Date picker" },
  Upload: { maxLines: 150, description: "File upload" },
  Search: { maxLines: 100, description: "Search input" },
  Label: { maxLines: 40, description: "Form labels" },
  // Action
  Button: { maxLines: 80, description: "Clickable buttons" },
  Link: { maxLines: 60, description: "Navigation links" },
  Icon: { maxLines: 40, description: "Icon wrappers" },
  Dropdown: { maxLines: 250, description: "Dropdown menus" },
  // Feedback
  Alert: { maxLines: 80, description: "Alert messages" },
  Toast: { maxLines: 80, description: "Toast notifications" },
  Progress: { maxLines: 60, description: "Progress indicators" },
  Spinner: { maxLines: 40, description: "Loading spinners" },
  Error: { maxLines: 80, description: "Error boundaries/display" },
  // Overlay
  Modal: { maxLines: 150, description: "Modal dialogs" },
  Dialog: { maxLines: 150, description: "Dialog components" },
  Drawer: { maxLines: 150, description: "Slide-out drawers" },
  Popover: { maxLines: 120, description: "Popover tooltips" },
  Tooltip: { maxLines: 80, description: "Hover tooltips" },
  Sheet: { maxLines: 150, description: "Bottom/side sheets" },
  Command: { maxLines: 200, description: "Command palette" },
  // Typography
  Text: { maxLines: 60, description: "Text primitives" },
  Heading: { maxLines: 60, description: "Heading components" },
  Code: { maxLines: 80, description: "Code display" },
  // Media
  Image: { maxLines: 80, description: "Image components" },
  Video: { maxLines: 100, description: "Video players" },
  // Animation
  Animate: { maxLines: 120, description: "Animation wrappers" },
  Transition: { maxLines: 80, description: "Transition wrappers" },
  Motion: { maxLines: 100, description: "Motion components" },
  // Separator
  Separator: { maxLines: 40, description: "Visual separators" },
  Divider: { maxLines: 40, description: "Content dividers" },
  // Provider
  Provider: { maxLines: 80, description: "Context providers" },
  Theme: { maxLines: 80, description: "Theme components" },
};

const APPROVED_PREFIXES = Object.keys(COMPONENT_TYPES);

// =============================================================================
// 1. UI COMPONENT NAMING
// =============================================================================

describe("Frontend: 1. UI Component Naming", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  if (uiFiles.length === 0) {
    it("skip: no UI component files yet", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const file of uiFiles) {
    const name = basename(file, ".tsx");
    const pascalName = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    it(`${rel(file)}: must start with approved component type`, () => {
      const matchesPrefix = APPROVED_PREFIXES.some((prefix) =>
        pascalName.startsWith(prefix),
      );
      expect(
        matchesPrefix,
        `"${pascalName}" does not start with approved prefix. Approved: ${APPROVED_PREFIXES.join(", ")}`,
      ).toBe(true);
    });
  }
});

// =============================================================================
// 2. UI COMPONENT LINE LIMITS
// =============================================================================

describe("Frontend: 2. UI Component Line Limits", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  for (const file of uiFiles) {
    const name = basename(file, ".tsx");
    const pascalName = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    // Match longest prefix first (so "Table" wins over "Tab", "Textarea" over "Text")
    const matchedType = [...APPROVED_PREFIXES]
      .sort((a, b) => b.length - a.length)
      .find((prefix) => pascalName.startsWith(prefix));

    if (matchedType) {
      const maxLines = COMPONENT_TYPES[matchedType]!.maxLines;

      it(`${rel(file)}: max ${maxLines} lines`, () => {
        const content = read(file);
        const count = lineCount(content);
        expect(
          count,
          `${rel(file)}: ${count} lines (max: ${maxLines})`,
        ).toBeLessThanOrEqual(maxLines);
      });
    }
  }
});

// =============================================================================
// 3. COMPONENT EXPORT RULES
// =============================================================================

describe("Frontend: 3. Component Export Rules", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  for (const file of uiFiles) {
    it(`${rel(file)}: must have at least one named export`, () => {
      const content = read(file);
      const hasExport = /export\s+(function|const|{)/.test(content);
      expect(
        hasExport,
        `${rel(file)}: no named export found`,
      ).toBe(true);
    });

    it(`${rel(file)}: must not use default export`, () => {
      const content = read(file);
      const hasDefaultExport = /^export\s+default\s/m.test(content);
      expect(
        hasDefaultExport,
        `${rel(file)}: do not use default export — use named export`,
      ).toBe(false);
    });
  }
});

// =============================================================================
// 4. RESPONSIVE & FLUID DESIGN PATTERNS
// =============================================================================

describe("Frontend: 4. Responsive Design Patterns", () => {
  const componentFiles = [
    ...walkFiles(UI, ".tsx"),
    ...walkFiles(FEATURES, ".tsx"),
  ];

  if (componentFiles.length === 0) {
    it("skip: no component files yet", () => {
      expect(true).toBe(true);
    });
    return;
  }

  describe("No inline fixed pixel width/height", () => {
    for (const file of componentFiles) {
      it(`${rel(file)}: no inline fixed width/height`, () => {
        const content = read(file);
        const hasInlineFixed = content
          .split("\n")
          .some(
            (l) =>
              /style=\{?\{[^}]*width:\s*["']\d+px["']/.test(l) &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasInlineFixed,
          `${rel(file)}: inline fixed px width found — use Tailwind responsive class`,
        ).toBe(false);
      });
    }
  });

  describe("cn() utility should be used for class merging", () => {
    for (const file of walkFiles(UI, ".tsx")) {
      it(`${rel(file)}: must use cn() if using className`, () => {
        const content = read(file);
        const hasClassName = content.includes("className");
        const hasCn = content.includes("cn(");
        const hasImportCn =
          content.includes("from") && content.includes("utils");

        if (hasClassName) {
          expect(
            hasCn || !hasImportCn,
            `${rel(file)}: uses className but does not import cn() — use cn() for class merging`,
          ).toBe(true);
        }
      });
    }
  });
});

// =============================================================================
// 5. ROUTE FILE RULES
// =============================================================================

describe("Frontend: 5. Route File Rules", () => {
  const routeFiles = walkFiles(ROUTES, ".tsx").filter(
    (f) => basename(f) !== "__root.tsx",
  );

  if (routeFiles.length === 0) {
    it("skip: no route files yet (excluding __root)", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const file of routeFiles) {
    it(`${rel(file)}: must not use useState`, () => {
      const content = read(file);
      const hasState = content.includes("useState(") &&
        !content.includes("// cherry:allow");
      expect(hasState).toBe(false);
    });

    it(`${rel(file)}: must not use useEffect`, () => {
      const content = read(file);
      const hasEffect = content.includes("useEffect(") &&
        !content.includes("// cherry:allow");
      expect(hasEffect).toBe(false);
    });

    it(`${rel(file)}: max 100 lines`, () => {
      const content = read(file);
      expect(lineCount(content)).toBeLessThanOrEqual(100);
    });
  }
});

// =============================================================================
// 6. FEATURES STRUCTURE
// =============================================================================

describe("Frontend: 6. Features Structure Rules", () => {
  const featureDirs = existsSync(FEATURES)
    ? readdirSync(FEATURES).filter((d) =>
        statSync(join(FEATURES, d)).isDirectory(),
      )
    : [];

  if (featureDirs.length === 0) {
    it("skip: features/ does not exist or is empty", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const feature of featureDirs) {
    it(`features/${feature}: kebab-case name`, () => {
      expect(feature).toMatch(/^[a-z][a-z0-9-]*$/);
    });
  }
});

// =============================================================================
// 7. IMPORT RULES
// =============================================================================

describe("Frontend: 7. Import Rules", () => {
  describe("Convex API direct import in component forbidden", () => {
    const componentFiles = walkFiles(COMPONENTS, ".tsx");

    for (const file of componentFiles) {
      it(`${rel(file)}: must not import convex/_generated/api`, () => {
        const content = read(file);
        const hasDirectApi = content
          .split("\n")
          .some(
            (l) =>
              l.includes("_generated/api") &&
              l.includes("import") &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasDirectApi,
          `${rel(file)}: direct convex API import — use hooks`,
        ).toBe(false);
      });
    }
  });
});

// =============================================================================
// 8. TAILWIND PATTERNS
// =============================================================================

describe("Frontend: 8. Tailwind Patterns", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  describe("Use semantic tokens instead of hardcoded hex colors", () => {
    for (const file of uiFiles) {
      it(`${rel(file)}: no hardcoded hex color`, () => {
        const content = read(file);
        const hasHardcodedColor = content
          .split("\n")
          .some(
            (l) =>
              l.includes("className") &&
              /#[0-9a-fA-F]{3,8}/.test(l) &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasHardcodedColor,
          `${rel(file)}: hardcoded hex color — use semantic token (bg-primary, text-muted-foreground)`,
        ).toBe(false);
      });
    }
  });
});
