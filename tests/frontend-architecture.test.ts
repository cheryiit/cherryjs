import { describe, it, expect } from "vitest";
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from "fs";
import { join, relative, basename, dirname } from "path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const COMPONENTS = join(APP, "components");
const UI = join(COMPONENTS, "ui");
const FEATURES = join(APP, "features");
const ROUTES = join(APP, "routes");
const LIB = join(APP, "lib");

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

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

function lineCount(content: string): number {
  return content.split("\n").length;
}

function rel(path: string): string {
  return relative(ROOT, path);
}

// ── Component Type Registry ───────────────────────────────────────────────────
// All approved component name prefixes and their max line counts.
// Component file names MUST start with one of these prefixes (PascalCase filename).

const COMPONENT_TYPES: Record<string, { maxLines: number; description: string }> = {
  // ── Layout ─────────────────────────────────────────────────────────────────
  Layout: { maxLines: 150, description: "Page layouts, grid systems" },
  Container: { maxLines: 80, description: "Wrapper containers" },
  Section: { maxLines: 100, description: "Page sections" },
  Grid: { maxLines: 100, description: "Grid layout primitives" },
  Stack: { maxLines: 60, description: "Flex stack components" },
  Sidebar: { maxLines: 200, description: "Sidebar navigation" },

  // ── Navigation ─────────────────────────────────────────────────────────────
  Navbar: { maxLines: 150, description: "Top navigation bar" },
  Nav: { maxLines: 120, description: "Navigation component" },
  Breadcrumb: { maxLines: 80, description: "Breadcrumb navigation" },
  Pagination: { maxLines: 100, description: "Pagination controls" },
  Tab: { maxLines: 100, description: "Tab navigation" },
  Menu: { maxLines: 120, description: "Menu / dropdown menu" },

  // ── Data Display ───────────────────────────────────────────────────────────
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

  // ── Form ───────────────────────────────────────────────────────────────────
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

  // ── Action ─────────────────────────────────────────────────────────────────
  Button: { maxLines: 80, description: "Clickable buttons" },
  Link: { maxLines: 60, description: "Navigation links" },
  Icon: { maxLines: 40, description: "Icon wrappers" },
  Dropdown: { maxLines: 250, description: "Dropdown menus" },

  // ── Feedback ───────────────────────────────────────────────────────────────
  Alert: { maxLines: 80, description: "Alert messages" },
  Toast: { maxLines: 80, description: "Toast notifications" },
  Progress: { maxLines: 60, description: "Progress indicators" },
  Spinner: { maxLines: 40, description: "Loading spinners" },
  Error: { maxLines: 80, description: "Error boundaries/display" },

  // ── Overlay ────────────────────────────────────────────────────────────────
  Modal: { maxLines: 150, description: "Modal dialogs" },
  Dialog: { maxLines: 150, description: "Dialog components" },
  Drawer: { maxLines: 150, description: "Slide-out drawers" },
  Popover: { maxLines: 120, description: "Popover tooltips" },
  Tooltip: { maxLines: 80, description: "Hover tooltips" },
  Sheet: { maxLines: 150, description: "Bottom/side sheets" },
  Command: { maxLines: 200, description: "Command palette" },

  // ── Typography ─────────────────────────────────────────────────────────────
  Text: { maxLines: 60, description: "Text primitives" },
  Heading: { maxLines: 60, description: "Heading components" },
  Code: { maxLines: 80, description: "Code display" },

  // ── Media ──────────────────────────────────────────────────────────────────
  Image: { maxLines: 80, description: "Image components" },
  Video: { maxLines: 100, description: "Video players" },

  // ── Animation ──────────────────────────────────────────────────────────────
  Animate: { maxLines: 120, description: "Animation wrappers" },
  Transition: { maxLines: 80, description: "Transition wrappers" },
  Motion: { maxLines: 100, description: "Motion components" },

  // ── Separator ──────────────────────────────────────────────────────────────
  Separator: { maxLines: 40, description: "Visual separators" },
  Divider: { maxLines: 40, description: "Content dividers" },

  // ── Provider ───────────────────────────────────────────────────────────────
  Provider: { maxLines: 80, description: "Context providers" },
  Theme: { maxLines: 80, description: "Theme components" },
};

const APPROVED_PREFIXES = Object.keys(COMPONENT_TYPES);

// =============================================================================
// 1. UI COMPONENT NAMING
// =============================================================================

describe("Frontend: 1. UI Component İsimlendirme", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  if (uiFiles.length === 0) {
    it("skip: henüz UI component dosyası yok", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const file of uiFiles) {
    const name = basename(file, ".tsx");
    // PascalCase'e çevir: "button" → "Button", "date-picker" → "DatePicker"
    const pascalName = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    it(`${rel(file)}: onaylı component type ile başlamalı`, () => {
      const matchesPrefix = APPROVED_PREFIXES.some((prefix) =>
        pascalName.startsWith(prefix),
      );

      expect(
        matchesPrefix,
        `"${pascalName}" onaylı prefix ile başlamıyor. Onaylılar: ${APPROVED_PREFIXES.join(", ")}`,
      ).toBe(true);
    });
  }
});

// =============================================================================
// 2. UI COMPONENT LINE LIMITS
// =============================================================================

describe("Frontend: 2. UI Component Satır Limitleri", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  for (const file of uiFiles) {
    const name = basename(file, ".tsx");
    const pascalName = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    // Find matching type
    const matchedType = APPROVED_PREFIXES.find((prefix) =>
      pascalName.startsWith(prefix),
    );

    if (matchedType) {
      const maxLines = COMPONENT_TYPES[matchedType]!.maxLines;

      it(`${rel(file)}: max ${maxLines} satır`, () => {
        const content = read(file);
        const count = lineCount(content);
        expect(
          count,
          `${rel(file)}: ${count} satır (max: ${maxLines})`,
        ).toBeLessThanOrEqual(maxLines);
      });
    }
  }
});

// =============================================================================
// 3. COMPONENT EXPORT RULES
// =============================================================================

describe("Frontend: 3. Component Export Kuralları", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  for (const file of uiFiles) {
    it(`${rel(file)}: en az bir named export olmalı`, () => {
      const content = read(file);
      const hasExport = /export\s+(function|const|{)/.test(content);
      expect(
        hasExport,
        `${rel(file)}: named export bulunamadı`,
      ).toBe(true);
    });

    it(`${rel(file)}: default export kullanmamalı`, () => {
      const content = read(file);
      const hasDefaultExport = /^export\s+default\s/m.test(content);
      expect(
        hasDefaultExport,
        `${rel(file)}: default export kullanma — named export kullan`,
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
    it("skip: henüz component dosyası yok", () => {
      expect(true).toBe(true);
    });
    return;
  }

  describe("Fixed pixel width kullanmamalı (responsive olmalı)", () => {
    for (const file of componentFiles) {
      it(`${rel(file)}: inline fixed width/height olmamalı`, () => {
        const content = read(file);
        // Inline style'da fixed px width/height — kullanma
        const hasInlineFixed = content
          .split("\n")
          .some(
            (l) =>
              /style=\{?\{[^}]*width:\s*["']\d+px["']/.test(l) &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasInlineFixed,
          `${rel(file)}: inline fixed px width bulundu — Tailwind responsive class kullan`,
        ).toBe(false);
      });
    }
  });

  describe("cn() utility kullanmalı (class merging)", () => {
    for (const file of walkFiles(UI, ".tsx")) {
      it(`${rel(file)}: className prop varsa cn() kullanmalı`, () => {
        const content = read(file);
        const hasClassName = content.includes("className");
        const hasCn = content.includes("cn(");
        const hasImportCn =
          content.includes("from") && content.includes("utils");

        if (hasClassName) {
          expect(
            hasCn || !hasImportCn,
            `${rel(file)}: className kullanıyor ama cn() import etmemiş — class merging için cn() kullan`,
          ).toBe(true);
        }
      });
    }
  });
});

// =============================================================================
// 5. ROUTE FILE RULES
// =============================================================================

describe("Frontend: 5. Route Dosya Kuralları", () => {
  const routeFiles = walkFiles(ROUTES, ".tsx").filter(
    (f) => basename(f) !== "__root.tsx",
  );

  if (routeFiles.length === 0) {
    it("skip: henüz route dosyası yok (__root hariç)", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const file of routeFiles) {

    it(`${rel(file)}: useState kullanmamalı`, () => {
      const content = read(file);
      const hasState = content.includes("useState(") &&
        !content.includes("// cherry:allow");
      expect(hasState).toBe(false);
    });

    it(`${rel(file)}: useEffect kullanmamalı`, () => {
      const content = read(file);
      const hasEffect = content.includes("useEffect(") &&
        !content.includes("// cherry:allow");
      expect(hasEffect).toBe(false);
    });

    it(`${rel(file)}: max 100 satır`, () => {
      const content = read(file);
      expect(lineCount(content)).toBeLessThanOrEqual(100);
    });
  }
});

// =============================================================================
// 6. FEATURES STRUCTURE
// =============================================================================

describe("Frontend: 6. Features Yapı Kuralları", () => {
  const featureDirs = existsSync(FEATURES)
    ? readdirSync(FEATURES).filter((d) =>
        statSync(join(FEATURES, d)).isDirectory(),
      )
    : [];

  if (featureDirs.length === 0) {
    it("skip: features/ henüz yok veya boş", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const feature of featureDirs) {
    const featureDir = join(FEATURES, feature);

    it(`features/${feature}: kebab-case isim`, () => {
      expect(feature).toMatch(/^[a-z][a-z0-9-]*$/);
    });
  }
});

// =============================================================================
// 7. IMPORT RULES
// =============================================================================

describe("Frontend: 7. Import Kuralları", () => {
  const allAppFiles = walkFiles(APP, ".tsx").concat(walkFiles(APP, ".ts"));

  describe("Convex API doğrudan component'te import yasak", () => {
    const componentFiles = walkFiles(COMPONENTS, ".tsx");

    for (const file of componentFiles) {
      it(`${rel(file)}: convex/_generated/api import etmemeli`, () => {
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
          `${rel(file)}: convex API doğrudan import — hooks aracılığıyla kullan`,
        ).toBe(false);
      });
    }
  });

  describe("UI components birbirini import edebilir", () => {
    // Bu test sadece bilgi amaçlı — UI components arası import serbesttir
    it("UI→UI import serbesttir", () => {
      expect(true).toBe(true);
    });
  });
});

// =============================================================================
// 8. TAILWIND PATTERNS
// =============================================================================

describe("Frontend: 8. Tailwind Patterns", () => {
  const uiFiles = walkFiles(UI, ".tsx");

  describe("Hardcoded color values yerine semantic token kullan", () => {
    for (const file of uiFiles) {
      it(`${rel(file)}: hardcoded hex color olmamalı`, () => {
        const content = read(file);
        // className içinde #fff, #000, #hex pattern — kullanma
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
          `${rel(file)}: hardcoded hex color — semantic token (bg-primary, text-muted-foreground) kullan`,
        ).toBe(false);
      });
    }
  });
});

// =============================================================================
// 9. LIB/ INTEGRITY
// =============================================================================

describe("Frontend: 9. lib/ Bütünlüğü", () => {
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
  ];

  for (const file of REQUIRED_LIB_FILES) {
    it(`app/lib/${file} mevcut olmalı`, () => {
      expect(existsSync(join(LIB, file))).toBe(true);
    });
  }

  it("app/lib/utils.ts: cn() export etmeli", () => {
    const content = read(join(LIB, "utils.ts"));
    expect(content).toContain("export function cn");
  });
});

// =============================================================================
// 10. STYLES INTEGRITY
// =============================================================================

describe("Frontend: 10. Styles Bütünlüğü", () => {
  it("globals.css mevcut olmalı", () => {
    expect(
      existsSync(join(APP, "styles", "globals.css")),
    ).toBe(true);
  });

  it("globals.css: Tailwind import olmalı", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain("tailwindcss");
  });

  it("globals.css: dark mode tanımı olmalı", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain(".dark");
  });

  it("globals.css: CSS variables (design tokens) tanımlı olmalı", () => {
    const content = read(join(APP, "styles", "globals.css"));
    expect(content).toContain("--background");
    expect(content).toContain("--foreground");
    expect(content).toContain("--primary");
    expect(content).toContain("--radius");
  });
});
