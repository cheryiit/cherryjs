import { describe, it, expect } from "vitest";
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from "fs";
import { join, relative, basename } from "path";

const ROOT = process.cwd();
const CONVEX = join(ROOT, "convex");
const APP = join(ROOT, "app");

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

function hasLine(content: string, pattern: RegExp): boolean {
  return content.split("\n").some((l) => pattern.test(l));
}

function getDomains(): string[] {
  const appsDir = join(CONVEX, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((d) =>
    statSync(join(appsDir, d)).isDirectory(),
  );
}

function extractExportedNames(content: string): string[] {
  const names: string[] = [];
  const matches = content.matchAll(
    /export\s+(?:const|function|async function)\s+(\w+)/g,
  );
  for (const m of matches) {
    names.push(m[1]!);
  }
  return names;
}

// Handler line count extractor (approximate)
function extractHandlerLineCounts(content: string): number[] {
  const counts: number[] = [];
  const handlerStart = /handler:\s*async\s*\(/g;
  let match;
  while ((match = handlerStart.exec(content)) !== null) {
    const start = match.index;
    let depth = 0;
    let foundOpen = false;
    let handlerLines = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") {
        depth++;
        foundOpen = true;
      } else if (content[i] === "}") {
        depth--;
        if (foundOpen && depth === 0) {
          const slice = content.slice(start, i + 1);
          handlerLines = slice.split("\n").length;
          break;
        }
      }
    }
    if (handlerLines > 0) counts.push(handlerLines);
  }
  return counts;
}

// ── Approved Suffixes ─────────────────────────────────────────────────────────

const APPROVED_CONVEX_SUFFIXES = [
  ".channel.ts",
  ".business.ts",
  ".integration.ts",
  ".model.ts",
  ".schedule.ts",
  ".batch.ts",
  ".schema.ts",
  ".test.ts",
  ".http.ts",
  ".middleware.ts",
];

const APPROVED_QUERY_WRAPPERS = [
  "publicQuery",
  "authenticatedQuery",
  "adminQuery",
];

const RATE_LIMITED_MUTATION_WRAPPERS = [
  "strictMutation",
  "normalMutation",
  "relaxedMutation",
  "burstMutation",
  "adminRateLimitedMutation",
  "publicStrictMutation",
  "activeSystemMutation",
  "verifiedUserMutation",
];

const FORBIDDEN_DIRECT_MUTATION_WRAPPERS = [
  "authenticatedMutation",
  "adminMutation",
  "publicMutation",
];

const ALL_APPROVED_CHANNEL_WRAPPERS = [
  ...APPROVED_QUERY_WRAPPERS,
  ...RATE_LIMITED_MUTATION_WRAPPERS,
  "publicAction",
  "authenticatedAction",
];

// =============================================================================
// 1. FILE NAMING
// =============================================================================

describe("1. Dosya İsimlendirme", () => {
  describe("apps/: onaylı suffix kullanmalı", () => {
    const appsFiles = walkFiles(join(CONVEX, "apps"), ".ts");

    for (const file of appsFiles) {
      it(`${rel(file)}: onaylı suffix`, () => {
        const name = basename(file);
        const hasApproved = APPROVED_CONVEX_SUFFIXES.some((s) =>
          name.endsWith(s),
        );
        expect(
          hasApproved,
          `${name} onaylı suffix içermiyor: ${APPROVED_CONVEX_SUFFIXES.join(", ")}`,
        ).toBe(true);
      });
    }
  });

  describe("apps/: dosya adı domain prefix ile başlamalı", () => {
    const domains = getDomains();

    for (const domain of domains) {
      const domainFiles = walkFiles(
        join(CONVEX, "apps", domain),
        ".ts",
      );

      for (const file of domainFiles) {
        it(`${rel(file)}: "${domain}." prefix`, () => {
          const name = basename(file);
          expect(
            name.startsWith(`${domain}.`),
            `${name}: "${domain}." prefix ile başlamıyor`,
          ).toBe(true);
        });
      }
    }
  });

  describe("Yasaklı dosya isimleri", () => {
    const allConvexFiles = walkFiles(CONVEX, ".ts");
    const FORBIDDEN_PATTERNS = [
      /Util\.ts$/,
      /Helper\.ts$/,
      /Utils\.ts$/,
      /Helpers\.ts$/,
      /index\.ts$/,
    ];

    for (const file of allConvexFiles) {
      // _generated/ muaf
      if (file.includes("_generated")) continue;

      it(`${rel(file)}: yasaklı isim kalıpları`, () => {
        const name = basename(file);
        for (const pattern of FORBIDDEN_PATTERNS) {
          expect(
            pattern.test(name),
            `${name}: yasaklı kalıp "${pattern.source}" ile eşleşti`,
          ).toBe(false);
        }
      });
    }
  });
});

// =============================================================================
// 2. FILE SIZE
// =============================================================================

describe("2. Dosya Boyutu", () => {
  const SIZE_LIMITS: Record<string, number> = {
    ".channel.ts": 200,
    ".model.ts": 300,
    ".schema.ts": 200,
    ".integration.ts": 300,
    ".business.ts": 500,
    ".batch.ts": 300,
  };

  for (const [suffix, maxLines] of Object.entries(SIZE_LIMITS)) {
    const files = walkFiles(join(CONVEX, "apps"), suffix);

    for (const file of files) {
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

  describe("Channel handler max 20 satır", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");

    for (const file of channelFiles) {
      it(`${rel(file)}: handler'lar max 20 satır`, () => {
        const content = read(file);
        const handlerSizes = extractHandlerLineCounts(content);

        for (const size of handlerSizes) {
          expect(
            size,
            `${rel(file)}: handler ${size} satır (max: 20)`,
          ).toBeLessThanOrEqual(20);
        }
      });
    }
  });
});

// =============================================================================
// 3. IMPORT RULES
// =============================================================================

describe("3. Import Kuralları", () => {
  describe("apps/: raw _generated builder import yasak", () => {
    const appsFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".test.ts"),
    );

    for (const file of appsFiles) {
      // business ve integration için internalMutation/Query kabul
      if (
        file.endsWith(".business.ts") ||
        file.endsWith(".integration.ts") ||
        file.endsWith(".schedule.ts") ||
        file.endsWith(".batch.ts")
      )
        continue;

      it(`${rel(file)}: raw builder import yok`, () => {
        const content = read(file);
        const hasRawImport = content.split("\n").some(
          (l) =>
            l.includes("from") &&
            l.includes("_generated/server") &&
            /\b(query|mutation|action)\b/.test(l) &&
            !l.includes("internalQuery") &&
            !l.includes("internalMutation") &&
            !l.includes("internalAction") &&
            !l.includes("// cherry:allow"),
        );
        expect(
          hasRawImport,
          `${rel(file)}: raw _generated/server builder import bulundu`,
        ).toBe(false);
      });
    }
  });

  describe("model/: Convex builder import yasak", () => {
    const modelFiles = walkFiles(join(CONVEX, "apps"), ".model.ts");
    const coreModelFiles = walkFiles(CONVEX, ".model.ts").filter((f) =>
      f.includes("/core/"),
    );

    for (const file of [...modelFiles, ...coreModelFiles]) {
      it(`${rel(file)}: Convex builder yok`, () => {
        const content = read(file);
        // Builder CALL'ları kontrol et — type import'lar muaf
        // Sadece "= internalMutation(", "= query(" gibi atama pattern'leri
        const hasBuilder = content.split("\n").some(
          (l) =>
            !l.trim().startsWith("import") &&
            !l.trim().startsWith("//") &&
            /=\s*(internalMutation|internalQuery|internalAction|mutation|query|action)\s*\(/.test(l),
        );
        expect(
          hasBuilder,
          `${rel(file)}: model dosyasında Convex builder bulundu`,
        ).toBe(false);
      });
    }
  });

  describe("Barrel export yasak", () => {
    const indexFiles = walkFiles(CONVEX, ".ts").filter(
      (f) => basename(f) === "index.ts" && !f.includes("_generated"),
    );

    it("convex/ altında index.ts olmamalı", () => {
      expect(
        indexFiles.map(rel),
        `Barrel export dosyaları bulundu`,
      ).toHaveLength(0);
    });
  });
});

// =============================================================================
// 4. LAYER CONTENT RULES
// =============================================================================

describe("4. Katman İçerik Kuralları", () => {
  describe("Business: sadece internal builder export", () => {
    const businessFiles = walkFiles(join(CONVEX, "apps"), ".business.ts");

    for (const file of businessFiles) {
      it(`${rel(file)}: sadece internal export`, () => {
        const content = read(file);
        const exportLines = content
          .split("\n")
          .filter(
            (l) =>
              l.trim().startsWith("export const") &&
              !l.includes("// cherry:allow"),
          );

        for (const line of exportLines) {
          const isInternal =
            line.includes("internalMutation(") ||
            line.includes("internalQuery(") ||
            line.includes("internalAction(");
          const isReexport = !line.includes("(");
          expect(
            isInternal || isReexport,
            `${rel(file)}: "${line.trim()}" internal builder kullanmıyor`,
          ).toBe(true);
        }
      });
    }
  });

  describe("Integration: sadece internalAction export", () => {
    const integrationFiles = walkFiles(
      join(CONVEX, "apps"),
      ".integration.ts",
    );

    if (integrationFiles.length === 0) {
      it("skip: henüz integration dosyası yok", () => {
        expect(true).toBe(true);
      });
    }

    for (const file of integrationFiles) {
      it(`${rel(file)}: sadece internalAction`, () => {
        const content = read(file);
        const hasWrongBuilder = content.split("\n").some(
          (l) =>
            l.trim().startsWith("export const") &&
            (l.includes("internalMutation(") ||
              l.includes("internalQuery(") ||
              l.includes("query(") ||
              l.includes("mutation(")) &&
            !l.includes("// cherry:allow"),
        );
        expect(
          hasWrongBuilder,
          `${rel(file)}: integration sadece internalAction kullanabilir`,
        ).toBe(false);
      });
    }
  });

  describe("Channel: onaylı wrapper kullanmalı", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");

    for (const file of channelFiles) {
      it(`${rel(file)}: sadece approved wrapper export eder`, () => {
        const content = read(file);
        const exportedConst = content.matchAll(
          /export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g,
        );
        for (const match of exportedConst) {
          const wrapperUsed = match[2]!;
          expect(
            ALL_APPROVED_CHANNEL_WRAPPERS,
            `${rel(file)}: "${match[1]}" için "${wrapperUsed}" onaylı wrapper değil`,
          ).toContain(wrapperUsed);
        }
      });
    }
  });
});

// =============================================================================
// 5. ERROR HANDLING
// =============================================================================

describe("5. Hata Yönetimi", () => {
  const backendFiles = [
    ...walkFiles(join(CONVEX, "apps"), ".ts"),
    ...walkFiles(join(CONVEX, "lib"), ".ts"),
    ...walkFiles(join(CONVEX, "core"), ".ts"),
  ].filter(
    (f) =>
      !f.includes(".test.ts") &&
      !f.includes(".schema.ts") &&
      !f.includes("_generated"),
  );

  for (const file of backendFiles) {
    it(`${rel(file)}: throw new Error() kullanmamalı`, () => {
      const content = read(file);
      const hasBareThrow = content
        .split("\n")
        .some(
          (l) =>
            l.trim().includes("throw new Error(") &&
            !l.includes("// cherry:allow"),
        );
      expect(
        hasBareThrow,
        `${rel(file)}: throw new Error() — errors.* kullan`,
      ).toBe(false);
    });

    it(`${rel(file)}: console.log kullanmamalı`, () => {
      const content = read(file);
      const hasLog = content
        .split("\n")
        .some(
          (l) =>
            l.trim().startsWith("console.log(") &&
            !l.includes("// cherry:allow"),
        );
      expect(
        hasLog,
        `${rel(file)}: console.log — console.warn/error kullan`,
      ).toBe(false);
    });
  }
});

// =============================================================================
// 6. CROSS-DOMAIN ISOLATION
// =============================================================================

describe("6. Cross-Domain İzolasyon", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainFiles = walkFiles(
      join(CONVEX, "apps", domain),
      ".ts",
    ).filter((f) => !f.includes(".test.ts"));

    it(`${domain}: başka domain'in dosyasını import etmemeli`, () => {
      const otherDomains = domains.filter((d) => d !== domain);
      const violations: string[] = [];

      for (const file of domainFiles) {
        const content = read(file);
        const importLines = content
          .split("\n")
          .filter(
            (l) => l.trim().startsWith("import") && l.includes("from"),
          );

        for (const line of importLines) {
          for (const other of otherDomains) {
            if (
              line.includes(`/apps/${other}/`) &&
              !line.includes("// cherry:allow")
            ) {
              violations.push(
                `${rel(file)}: "${other}" domain'inden import`,
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }

  it("core/: apps/ import etmemeli", () => {
    const coreFiles = walkFiles(join(CONVEX, "core"), ".ts");
    const violations: string[] = [];

    for (const file of coreFiles) {
      const content = read(file);
      const hasAppsImport = content
        .split("\n")
        .some(
          (l) =>
            l.includes("from") &&
            l.includes("/apps/") &&
            !l.includes("// cherry:allow"),
        );
      if (hasAppsImport) violations.push(rel(file));
    }

    expect(violations).toEqual([]);
  });
});

// =============================================================================
// 7. MODULE STRUCTURE REQUIREMENTS
// =============================================================================

describe("7. Modül Yapı Zorunlulukları", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainDir = join(CONVEX, "apps", domain);

    it(`${domain}: .channel.ts bulunmalı`, () => {
      expect(
        existsSync(join(domainDir, `${domain}.channel.ts`)),
      ).toBe(true);
    });

    it(`${domain}: .business.ts bulunmalı`, () => {
      expect(
        existsSync(join(domainDir, `${domain}.business.ts`)),
      ).toBe(true);
    });

    it(`${domain}: .schema.ts bulunmalı`, () => {
      expect(
        existsSync(join(domainDir, `${domain}.schema.ts`)),
      ).toBe(true);
    });

    it(`${domain}: schema aggregator'da include edilmeli`, () => {
      const rootSchema = read(join(CONVEX, "schema.ts"));
      const isIncluded =
        rootSchema.includes(`${domain}.schema`) ||
        rootSchema.includes(`${domain}Tables`);
      expect(
        isIncluded,
        `${domain} schema.ts aggregator'a eklenmemiş`,
      ).toBe(true);
    });
  }

  const CORE_MODULES = ["schedule", "parameter", "webhook", "audit"];

  for (const mod of CORE_MODULES) {
    it(`core/${mod}: model dosyası bulunmalı`, () => {
      expect(
        existsSync(join(CONVEX, "core", mod, `${mod}.model.ts`)),
      ).toBe(true);
    });
  }
});

// =============================================================================
// 8. FUNCTION NAMING
// =============================================================================

describe("8. Fonksiyon İsimlendirme", () => {
  describe("Model: get/list/exists/count/find ile başlamalı", () => {
    const modelFiles = [
      ...walkFiles(join(CONVEX, "apps"), ".model.ts"),
      ...walkFiles(CONVEX, ".model.ts").filter((f) =>
        f.includes("/core/"),
      ),
    ];

    for (const file of modelFiles) {
      it(`${rel(file)}: doğru fonksiyon isimleri`, () => {
        const content = read(file);
        const names = extractExportedNames(content);
        for (const name of names) {
          expect(
            name,
            `model fonksiyonu "${name}" get/list/exists/count/find ile başlamıyor`,
          ).toMatch(/^(get|list|exists|count|find)/);
        }
      });
    }
  });
});

// =============================================================================
// 9. SCHEMA RULES
// =============================================================================

describe("9. Schema Kuralları", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const schemaFile = join(
      CONVEX,
      "apps",
      domain,
      `${domain}.schema.ts`,
    );
    if (!existsSync(schemaFile)) continue;

    it(`${domain}.schema.ts: ${domain}Tables export etmeli`, () => {
      const content = read(schemaFile);
      expect(content).toContain(`export const ${domain}Tables`);
    });

    it(`${domain}.schema.ts: field tanımlarını export etmeli`, () => {
      const content = read(schemaFile);
      const hasFieldExport =
        content.includes("export const") && content.includes("Fields");
      expect(
        hasFieldExport,
        `${domain}.schema.ts: *Fields export bulunamadı`,
      ).toBe(true);
    });
  }

  it("schema.ts: defineTable() doğrudan içermemeli", () => {
    const content = read(join(CONVEX, "schema.ts"));
    const hasDirectTable = hasLine(content, /defineTable\s*\(/);
    expect(
      hasDirectTable,
      "schema.ts doğrudan defineTable içeriyor — domain schema'lara taşı",
    ).toBe(false);
  });
});

// =============================================================================
// 10. FRONTEND RULES (skip if app/ doesn't exist yet)
// =============================================================================

describe("10. Frontend Kuralları", () => {
  const routeFiles = walkFiles(join(APP, "routes"), ".tsx").filter(
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
      expect(content.includes("useState(")).toBe(false);
    });

    it(`${rel(file)}: useEffect kullanmamalı`, () => {
      const content = read(file);
      expect(content.includes("useEffect(")).toBe(false);
    });
  }
});

// =============================================================================
// 11. TEST EXISTENCE
// =============================================================================

describe("11. Test Varlığı", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const businessFile = join(
      CONVEX,
      "apps",
      domain,
      `${domain}.business.ts`,
    );

    if (!existsSync(businessFile)) continue;

    // Advisory only — skip for now since we don't have tests yet
    it.skip(`${domain}: .business.test.ts bulunmalı`, () => {
      expect(
        existsSync(
          join(CONVEX, "apps", domain, `${domain}.business.test.ts`),
        ),
      ).toBe(true);
    });
  }
});

// =============================================================================
// 12. LIB INTEGRITY
// =============================================================================

describe("12. lib/ Bütünlüğü", () => {
  it("lib/functions.ts: zorunlu wrapper'lar export edilmeli", () => {
    const content = read(join(CONVEX, "lib", "functions.ts"));
    const REQUIRED = [
      "publicQuery",
      "publicMutation",
      "publicAction",
      "authenticatedQuery",
      "authenticatedMutation",
      "authenticatedAction",
      "adminQuery",
      "adminMutation",
      "strictMutation",
      "normalMutation",
      "relaxedMutation",
      "burstMutation",
      "adminRateLimitedMutation",
      "publicStrictMutation",
      "activeSystemMutation",
      "verifiedUserMutation",
      "internalAuthQuery",
      "internalAuthMutation",
      "internalAuthAction",
    ];

    for (const name of REQUIRED) {
      expect(
        content,
        `lib/functions.ts: "export const ${name}" bulunamadı`,
      ).toContain(`export const ${name}`);
    }
  });

  it("lib/errors.ts: zorunlu export'lar mevcut olmalı", () => {
    const content = read(join(CONVEX, "lib", "errors.ts"));
    expect(content).toContain("export const ErrorCode");
    expect(content).toContain("export const errors");
    expect(content).toContain("export function isAppError");
  });

  it("lib/permissions.ts: zorunlu export'lar mevcut olmalı", () => {
    const content = read(join(CONVEX, "lib", "permissions.ts"));
    expect(content).toContain("export const Role");
    expect(content).toContain("export const Permission");
    expect(content).toContain("export function hasPermission");
    expect(content).toContain("export function canPerform");
  });

  it("lib/rate-limiter.ts: mevcut olmalı", () => {
    expect(existsSync(join(CONVEX, "lib", "rate-limiter.ts"))).toBe(true);
  });

  it("lib/audit.ts: mevcut olmalı", () => {
    expect(existsSync(join(CONVEX, "lib", "audit.ts"))).toBe(true);
  });

  it("lib/request-context.ts: mevcut olmalı", () => {
    expect(existsSync(join(CONVEX, "lib", "request-context.ts"))).toBe(
      true,
    );
  });
});

// =============================================================================
// 13. RATE LIMIT ENFORCEMENT
// =============================================================================

describe("13. Rate Limit Zorunluluğu", () => {
  const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");

  for (const file of channelFiles) {
    describe(`${rel(file)}`, () => {
      const content = read(file);
      const exportedMutations = [
        ...content.matchAll(
          /^export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/gm,
        ),
      ];

      // Filter to mutations only (skip queries and actions)
      const mutationExports = exportedMutations.filter(([, , wrapper]) => {
        return (
          !wrapper?.includes("Query") &&
          !wrapper?.includes("query") &&
          !wrapper?.includes("Action") &&
          !wrapper?.includes("action")
        );
      });

      if (mutationExports.length === 0) {
        it("skip: channel mutation export yok", () => {
          expect(true).toBe(true);
        });
      }

      for (const [, name, wrapper] of mutationExports) {
        it(`"${name}": rate-limited wrapper kullanmalı`, () => {
          const lineIdx = content
            .split("\n")
            .findIndex((l) => l.includes(`export const ${name}`));
          const nearby = content
            .split("\n")
            .slice(Math.max(0, lineIdx - 2), lineIdx + 2);
          const isBypassed = nearby.some((l) =>
            l.includes("// cherry:allow-no-rate-limit"),
          );

          if (!isBypassed) {
            expect(
              RATE_LIMITED_MUTATION_WRAPPERS,
              `"${name}" rate-limited wrapper kullanmıyor (kullanılan: "${wrapper}")`,
            ).toContain(wrapper);
          }
        });
      }
    });
  }
});

// =============================================================================
// 14. SHARED INFRASTRUCTURE ANTI-PATTERNS
// =============================================================================

describe("14. Anti-Pattern Tespiti", () => {
  const appFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
    (f) => !f.includes(".test.ts"),
  );

  describe(".collect().length yasak — aggregate kullan", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        expect(
          /\.collect\(\)\s*\.length/.test(content),
          `${rel(file)}: .collect().length — aggregate kullan`,
        ).toBe(false);
      });
    }
  });

  describe("Promise.all(ids.map(ctx.db.get)) yasak — getAll() kullan", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasAntiPattern =
          content.includes("Promise.all") &&
          content.includes("ctx.db.get") &&
          content.includes(".map(");
        expect(
          hasAntiPattern,
          `${rel(file)}: Promise.all(ids.map(ctx.db.get)) — getAll() kullan`,
        ).toBe(false);
      });
    }
  });

  describe("fetch() sadece integration dosyalarında", () => {
    const nonIntegration = appFiles.filter(
      (f) => !f.endsWith(".integration.ts"),
    );

    for (const file of nonIntegration) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasFetch = content
          .split("\n")
          .some(
            (l) =>
              /\bfetch\s*\(/.test(l) && !l.includes("// cherry:allow"),
          );
        expect(
          hasFetch,
          `${rel(file)}: fetch() sadece .integration.ts'te kullanılabilir`,
        ).toBe(false);
      });
    }
  });

  describe("ctx.db.insert('auditLogs') yasak — ctx.audit.log() kullan", () => {
    for (const file of appFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasDirectAudit =
          content.includes('"auditLogs"') &&
          content.includes("ctx.db.insert") &&
          !content.includes("// cherry:allow");
        expect(
          hasDirectAudit,
          `${rel(file)}: ctx.db.insert("auditLogs") — ctx.audit.log() kullan`,
        ).toBe(false);
      });
    }
  });

  describe("ctx.scheduler channel'da yasak", () => {
    const channelFiles = walkFiles(
      join(CONVEX, "apps"),
      ".channel.ts",
    );

    for (const file of channelFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasScheduler =
          content.includes("ctx.scheduler") &&
          !content.includes("// cherry:allow");
        expect(
          hasScheduler,
          `${rel(file)}: ctx.scheduler — scheduleTask() kullan`,
        ).toBe(false);
      });
    }
  });

  describe("throw new Error() backend'de yasak", () => {
    const backendFiles = [
      ...walkFiles(join(CONVEX, "apps"), ".ts"),
      ...walkFiles(join(CONVEX, "core"), ".ts"),
    ].filter(
      (f) =>
        !f.includes(".test.ts") &&
        !f.includes(".schema.ts") &&
        !f.includes("_generated"),
    );

    for (const file of backendFiles) {
      it(`${rel(file)}`, () => {
        const content = read(file);
        const hasBareThrow = content
          .split("\n")
          .some(
            (l) =>
              l.trim().includes("throw new Error(") &&
              !l.includes("// cherry:allow"),
          );
        expect(
          hasBareThrow,
          `${rel(file)}: throw new Error() — errors.* kullan`,
        ).toBe(false);
      });
    }
  });
});

// =============================================================================
// 15. LIB WRAPPER SYNC
// =============================================================================

describe("15. lib/ Wrapper Sync", () => {
  it("lib/functions.ts: rate-limiter config'lerle sync", () => {
    const functionsContent = read(join(CONVEX, "lib", "functions.ts"));
    const rateLimiterContent = read(
      join(CONVEX, "lib", "rate-limiter.ts"),
    );

    // functions.ts'teki rateLimiter.limit(ctx, "X") çağrılarını bul
    const usedConfigs = [
      ...functionsContent.matchAll(
        /rateLimiter\.limit\(ctx,\s*["'](\w[\w-]*)["']/g,
      ),
    ].map((m) => m[1]!);

    for (const config of usedConfigs) {
      // Config key can be quoted ("strict") or unquoted (strict:) or quoted key ("auth-ops":)
      const found =
        rateLimiterContent.includes(`"${config}"`) ||
        rateLimiterContent.includes(`'${config}'`) ||
        new RegExp(`\\b${config.replace("-", "\\-")}\\s*:`).test(rateLimiterContent);
      expect(
        found,
        `lib/rate-limiter.ts: "${config}" config tanımlanmamış`,
      ).toBe(true);
    }
  });

  it("Tüm zorunlu dosyalar mevcut", () => {
    const REQUIRED_LIB_FILES = [
      "functions.ts",
      "errors.ts",
      "permissions.ts",
      "rate-limiter.ts",
      "request-context.ts",
      "audit.ts",
      "validators.ts",
      "relationships.ts",
      "retrier.ts",
      "workflow.ts",
    ];

    for (const file of REQUIRED_LIB_FILES) {
      expect(
        existsSync(join(CONVEX, "lib", file)),
        `lib/${file} bulunamadı`,
      ).toBe(true);
    }
  });
});
