# Architectural Testler — Kapsamlı Referans

**Dosya:** `tests/architecture.test.ts`
**Ne çalıştırır:** Vitest (Convex bağımsız — saf dosya okuma)
**Ne zaman:** Her commit pre-push hook + CI her PR

Bu testler kod yazmadan önce "kural koyar", yazıldıkça enforce eder.
AI farklı bir session'da farklı bir konvansiyona sürüklense bile test fail verir.

---

## Test Kategorileri

| Kategori | Örnek Kural |
|----------|------------|
| [1. Dosya İsimlendirme](#1-dosya-i̇simlendirme) | `trading.business.ts` — yanlış: `tradingLogic.ts` |
| [2. Dosya Boyutu](#2-dosya-boyutu) | `.channel.ts` max 150 satır |
| [3. Import Kuralları](#3-import-kuralları) | `apps/` raw builder import edemez |
| [4. Katman İçerik Kuralları](#4-katman-i̇çerik-kuralları) | `business.ts` sadece `internalMutation` |
| [5. Hata Yönetimi](#5-hata-yönetimi) | `throw new Error()` yasak |
| [6. Cross-Domain İzolasyon](#6-cross-domain-i̇zolasyon) | Domain birbirinin DB'sine erişemez |
| [7. Modül Yapı Zorunlulukları](#7-modül-yapı-zorunlulukları) | Her domain `.channel.ts` + `.business.ts` içermeli |
| [8. Fonksiyon İsimlendirme](#8-fonksiyon-i̇simlendirme) | Model: `get*` / `list*` / `exists*` |
| [9. Schema Kuralları](#9-schema-kuralları) | Her tablonun field tanımları export edilmeli |
| [10. Frontend Kuralları](#10-frontend-kuralları) | Route dosyası 50 satır max |
| [11. Test Varlığı](#11-test-varlığı) | Her `.business.ts` için `.test.ts` |
| [12. lib/ Bütünlüğü](#12-lib-bütünlüğü) | Tüm wrapper'lar export edilmeli |
| [13. Rate Limit Zorunluluğu](#13-rate-limit-zorunluluğu) | Her channel mutation rate-limited wrapper kullanmalı |
| [14. Shared Infrastructure Anti-Pattern](#14-shared-infrastructure-anti-pattern) | `.collect().length`, direkt `fetch()`, direkt `auditLogs` insert yasak |
| [15. lib/ Wrapper Bütünlüğü](#15-lib-wrapper-bütünlüğü) | `APPROVED_CHANNEL_MUTATION_WRAPPERS` listesiyle sync |

---

## Test Altyapısı

```typescript
// tests/architecture.test.ts
import { describe, it, expect } from "vitest";
import {
  readdirSync, readFileSync, statSync, existsSync,
} from "fs";
import { join, relative, basename, dirname, extname } from "path";

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

function lines(content: string): number {
  return content.split("\n").length;
}

function rel(path: string): string {
  return relative(ROOT, path);
}

// Handler satır sayısını çıkar (yaklaşık)
function extractHandlerLineCounts(content: string): number[] {
  const counts: number[] = [];
  const handlerStart = /handler:\s*async\s*\(/g;
  let match;
  while ((match = handlerStart.exec(content)) !== null) {
    const start = match.index;
    let depth = 0;
    let inHandler = false;
    let handlerLines = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") { depth++; inHandler = true; }
      if (content[i] === "}") { depth--; }
      if (content[i] === "\n" && inHandler) handlerLines++;
      if (inHandler && depth === 0) break;
    }
    if (handlerLines > 0) counts.push(handlerLines);
  }
  return counts;
}

// Exported function isimlerini çıkar
function extractExportedNames(content: string): string[] {
  const matches = content.matchAll(
    /export\s+(?:const|function|async\s+function)\s+([a-zA-Z][a-zA-Z0-9]*)/g
  );
  return [...matches].map((m) => m[1]!);
}

function hasLine(content: string, pattern: RegExp): boolean {
  return content.split("\n").some(
    (l) => !l.trim().startsWith("//") && pattern.test(l)
  );
}

// Domain listesi
function getDomains(): string[] {
  const appsDir = join(CONVEX, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((d) =>
    statSync(join(appsDir, d)).isDirectory()
  );
}
```

---

## 1. Dosya İsimlendirme

```typescript
describe("Dosya İsimlendirme — Backend", () => {
  // apps/ altında sadece onaylı suffix'ler
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

  const appFiles = walkFiles(join(CONVEX, "apps"), ".ts");
  const coreFiles = walkFiles(join(CONVEX, "core"), ".ts");

  for (const file of [...appFiles, ...coreFiles]) {
    it(`${rel(file)}: onaylı suffix kullanmalı`, () => {
      const name = basename(file);
      const approved = APPROVED_CONVEX_SUFFIXES.some((s) => name.endsWith(s));
      expect(
        approved,
        `"${name}" onaylı suffix kullanmıyor.\nOnaylı: ${APPROVED_CONVEX_SUFFIXES.join(", ")}`
      ).toBe(true);
    });
  }

  // model/ dosyaları .model.ts ile bitmeli
  const modelFiles = walkFiles(join(CONVEX, "model"), ".ts");
  for (const file of modelFiles) {
    it(`${rel(file)}: .model.ts suffix'i kullanmalı`, () => {
      expect(basename(file)).toMatch(/\.model\.ts$/);
    });
  }

  // lib/ dosyaları özel — sabit isimler
  it("lib/ sadece onaylı dosyaları içermeli", () => {
    const LIB_FILES = [
      "functions.ts",
      "errors.ts",
      "permissions.ts",
      "rls.ts",
      "workflow.ts",
      "retrier.ts",
    ];
    const libFiles = readdirSync(join(CONVEX, "lib")).filter(
      (f) => f.endsWith(".ts")
    );
    for (const file of libFiles) {
      expect(
        LIB_FILES,
        `lib/${file} onaylı lib dosyaları listesinde değil`
      ).toContain(file);
    }
  });
});

describe("Dosya İsimlendirme — Frontend", () => {
  // components/ PascalCase .tsx
  const componentFiles = walkFiles(join(APP, "features"), ".tsx");
  for (const file of componentFiles) {
    it(`${rel(file)}: PascalCase component adı olmalı`, () => {
      const name = basename(file, ".tsx");
      expect(
        name[0],
        `"${name}" PascalCase değil — component isimleri büyük harfle başlar`
      ).toBe(name[0]!.toUpperCase());
    });
  }

  // hooks/ use ile başlamalı
  const hookFiles = walkFiles(join(APP, "features"), ".ts").filter((f) =>
    f.includes("/hooks/")
  );
  for (const file of hookFiles) {
    it(`${rel(file)}: use ile başlamalı`, () => {
      const name = basename(file, ".ts");
      expect(
        name,
        `"${name}" use ile başlamıyor`
      ).toMatch(/^use[A-Z]/);
    });
  }

  // routes/ dosyaları — camelCase veya $paramName veya _groupName
  const routeFiles = walkFiles(join(APP, "routes"), ".tsx");
  for (const file of routeFiles) {
    it(`${rel(file)}: route dosyası adı konvansiyona uymalı`, () => {
      const name = basename(file, ".tsx");
      // Geçerli pattern'ler: __root, index, _group, $param, camelCase, kebab-case
      const valid =
        /^(__root|index|_[a-zA-Z]|\$[a-zA-Z]|[a-z][a-zA-Z0-9-]*)$/.test(name);
      expect(valid, `Route dosyası adı "${name}" geçersiz`).toBe(true);
    });
  }
});
```

---

## 2. Dosya Boyutu

```typescript
describe("Dosya Boyutu Limitleri", () => {
  const LIMITS: Array<{ glob: string; max: number; description: string }> = [
    {
      glob: "convex/apps/**/*.channel.ts",
      max: 150,
      description: "Channel dosyası",
    },
    {
      glob: "convex/apps/**/*.business.ts",
      max: 350,
      description: "Business dosyası",
    },
    {
      glob: "convex/model/*.model.ts",
      max: 200,
      description: "Model dosyası",
    },
    {
      glob: "convex/apps/**/*.integration.ts",
      max: 300,
      description: "Integration dosyası",
    },
    {
      glob: "convex/apps/**/*.schedule.ts",
      max: 150,
      description: "Schedule dosyası",
    },
    {
      glob: "convex/apps/**/*.batch.ts",
      max: 250,
      description: "Batch dosyası",
    },
    {
      glob: "convex/apps/**/*.schema.ts",
      max: 200,
      description: "Schema dosyası",
    },
    {
      glob: "app/routes/**/*.tsx",
      max: 60,
      description: "Route dosyası",
    },
    {
      glob: "app/features/**/components/**/*.tsx",
      max: 200,
      description: "Component dosyası",
    },
    {
      glob: "app/features/**/hooks/**/*.ts",
      max: 80,
      description: "Hook dosyası",
    },
  ];

  for (const { glob: pattern, max, description } of LIMITS) {
    describe(`${description}: max ${max} satır`, () => {
      const dir = join(ROOT, pattern.split("/**")[0]!.split("/*")[0]!);
      const suffix = pattern.match(/\*(\.[a-z.]+)$/)?.[1] ?? ".ts";
      const files = walkFiles(dir, suffix);

      for (const file of files) {
        it(`${rel(file)}: ${max} satır limitini aşmamalı`, () => {
          const count = lines(read(file));
          expect(
            count,
            `${rel(file)}: ${count} satır (limit: ${max})`
          ).toBeLessThanOrEqual(max);
        });
      }
    });
  }

  // Channel handler'ları: max 20 satır
  describe("Channel handler'ları: max 20 satır", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");
    for (const file of channelFiles) {
      it(`${rel(file)}: handler'lar 20 satırı geçmemeli`, () => {
        const content = read(file);
        const handlerCounts = extractHandlerLineCounts(content);
        for (const count of handlerCounts) {
          expect(
            count,
            `${rel(file)}: bir handler ${count} satır (limit: 20)`
          ).toBeLessThanOrEqual(20);
        }
      });
    }
  });
});
```

---

## 3. Import Kuralları

```typescript
describe("Import Kuralları", () => {
  // channel.ts: raw builder import edemez
  describe("Channel: raw Convex builder import yasak", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");
    for (const file of channelFiles) {
      it(`${rel(file)}: ham builder import etmemeli`, () => {
        const content = read(file);
        const lines_ = content.split("\n").filter(
          (l) => !l.trim().startsWith("//") && !l.includes("import type")
        );
        const hasRaw = lines_.some(
          (l) =>
            (l.includes("from") && l.includes("_generated/server")) &&
            /\b(query|mutation|action)\b/.test(l) &&
            !l.includes("internalQuery") &&
            !l.includes("internalMutation") &&
            !l.includes("// cherry:allow")
        );
        expect(hasRaw, `${rel(file)}: ham builder import bulundu`).toBe(false);
      });
    }
  });

  // business.ts: sadece internal builder kullanabilir
  describe("Business: public builder kullanma yasak", () => {
    const businessFiles = walkFiles(join(CONVEX, "apps"), ".business.ts");
    for (const file of businessFiles) {
      it(`${rel(file)}: public builder export etmemeli`, () => {
        const content = read(file);
        const hasPublic = hasLine(
          content,
          /export\s+const\s+\w+\s*=\s*(query|mutation|action)\s*\(/
        );
        expect(
          hasPublic,
          `${rel(file)}: public builder (query/mutation/action) export edilmiş`
        ).toBe(false);
      });
    }
  });

  // integration.ts: ctx.db kullanamaz
  describe("Integration: ctx.db kullanma yasak", () => {
    const integrationFiles = walkFiles(join(CONVEX, "apps"), ".integration.ts");
    for (const file of integrationFiles) {
      it(`${rel(file)}: ctx.db kullanmamalı`, () => {
        const content = read(file);
        const hasDbAccess = hasLine(content, /\bctx\.db\b/) &&
          !content.includes("// cherry:allow");
        expect(
          hasDbAccess,
          `${rel(file)}: integration katmanında ctx.db kullanımı bulundu`
        ).toBe(false);
      });
    }
  });

  // model.ts: errors import edemez (model hata fırlatmaz)
  describe("Model: errors import etmemeli", () => {
    const modelFiles = walkFiles(join(CONVEX, "model"), ".ts");
    for (const file of modelFiles) {
      it(`${rel(file)}: lib/errors import etmemeli`, () => {
        const content = read(file);
        const hasErrors = content.includes('from "../lib/errors"') ||
          content.includes("from './lib/errors'");
        expect(
          hasErrors,
          `${rel(file)}: model katmanı errors import etmiş — model null döner, throw etmez`
        ).toBe(false);
      });
    }
  });

  // model.ts: internalMutation/Query içermemeli
  describe("Model: Convex builder içermemeli", () => {
    const modelFiles = walkFiles(join(CONVEX, "model"), ".ts");
    for (const file of modelFiles) {
      it(`${rel(file)}: Convex builder içermemeli`, () => {
        const content = read(file);
        const hasBuilder = hasLine(
          content,
          /\b(internalMutation|internalQuery|internalAction|mutation|query|action)\s*\(/
        );
        expect(
          hasBuilder,
          `${rel(file)}: model dosyasında Convex builder bulundu`
        ).toBe(false);
      });
    }
  });

  // No barrel exports in convex/
  describe("Convex: barrel (index.ts) export yasak", () => {
    const indexFiles = walkFiles(CONVEX, ".ts").filter(
      (f) => basename(f) === "index.ts"
    );
    it("convex/ altında index.ts olmamalı", () => {
      expect(
        indexFiles,
        `Barrel export dosyaları bulundu: ${indexFiles.map(rel).join(", ")}`
      ).toHaveLength(0);
    });
  });
});
```

---

## 4. Katman İçerik Kuralları

```typescript
describe("Katman İçerik Kuralları", () => {
  // business.ts: sadece internalMutation/Query export eder
  describe("Business: sadece internal export", () => {
    const businessFiles = walkFiles(join(CONVEX, "apps"), ".business.ts");
    for (const file of businessFiles) {
      it(`${rel(file)}: sadece internalMutation/internalQuery export eder`, () => {
        const content = read(file);
        const exportLines = content
          .split("\n")
          .filter(
            (l) =>
              l.trim().startsWith("export const") &&
              !l.includes("// cherry:allow")
          );

        for (const line of exportLines) {
          const isInternal =
            line.includes("internalMutation(") ||
            line.includes("internalQuery(") ||
            line.includes("internalAction(");
          // Aynı satırda = değil olabilir (export const foo = bar gibi re-export)
          const isReexport = !line.includes("(");
          expect(
            isInternal || isReexport,
            `${rel(file)}: "${line.trim()}" internal builder kullanmıyor`
          ).toBe(true);
        }
      });
    }
  });

  // integration.ts: sadece internalAction export eder
  describe("Integration: sadece internalAction export eder", () => {
    const integrationFiles = walkFiles(join(CONVEX, "apps"), ".integration.ts");
    for (const file of integrationFiles) {
      it(`${rel(file)}: sadece internalAction kullanmalı`, () => {
        const content = read(file);
        const hasWrongBuilder = hasLine(
          content,
          /=\s*(internalMutation|internalQuery|query|mutation|action)\s*\(/
        );
        expect(
          hasWrongBuilder,
          `${rel(file)}: integration sadece internalAction kullanabilir`
        ).toBe(false);
      });
    }
  });

  // channel.ts: authenticated/public/admin wrapper'lardan biri kullanılmalı
  describe("Channel: approved wrapper kullanmalı", () => {
    const APPROVED_WRAPPERS = [
      "publicQuery",
      "publicMutation",
      "publicAction",
      "authenticatedQuery",
      "authenticatedMutation",
      "authenticatedAction",
      "adminQuery",
      "adminMutation",
      "rateLimitedMutation",
      "activeSystemMutation",
      "verifiedUserMutation",
      "tradingMutation", // domain-spesifik wrappers
    ];
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");
    for (const file of channelFiles) {
      it(`${rel(file)}: sadece approved wrapper export eder`, () => {
        const content = read(file);
        const exportedConst = content.matchAll(
          /export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/g
        );
        for (const match of exportedConst) {
          const wrapperUsed = match[2]!;
          expect(
            APPROVED_WRAPPERS,
            `${rel(file)}: "${match[1]}" için "${wrapperUsed}" onaylı wrapper değil`
          ).toContain(wrapperUsed);
        }
      });
    }
  });
});
```

---

## 5. Hata Yönetimi

```typescript
describe("Hata Yönetimi", () => {
  const backendFiles = [
    ...walkFiles(join(CONVEX, "apps"), ".ts"),
    ...walkFiles(join(CONVEX, "lib"), ".ts"),
    ...walkFiles(join(CONVEX, "core"), ".ts"),
  ];

  for (const file of backendFiles) {
    // test ve schema dosyaları muaf
    if (file.includes(".test.ts") || file.includes(".schema.ts")) continue;

    it(`${rel(file)}: throw new Error() kullanmamalı`, () => {
      const content = read(file);
      const hasBareThrow = content
        .split("\n")
        .some(
          (l) =>
            l.trim().includes("throw new Error(") &&
            !l.includes("// cherry:allow")
        );
      expect(
        hasBareThrow,
        `${rel(file)}: throw new Error() bulundu — errors.* kullan`
      ).toBe(false);
    });

    it(`${rel(file)}: console.log kullanmamalı`, () => {
      const content = read(file);
      const hasLog = content
        .split("\n")
        .some(
          (l) =>
            l.trim().startsWith("console.log(") &&
            !l.includes("// cherry:allow")
        );
      expect(
        hasLog,
        `${rel(file)}: console.log bulundu — console.warn/error kullan`
      ).toBe(false);
    });
  }
});
```

---

## 6. Cross-Domain İzolasyon

```typescript
describe("Cross-Domain İzolasyon", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainFiles = walkFiles(join(CONVEX, "apps", domain), ".ts");

    it(`${domain}: başka domain'in .ts dosyasını doğrudan import etmemeli`, () => {
      const otherDomains = domains.filter((d) => d !== domain);

      for (const file of domainFiles) {
        const content = read(file);
        const importLines = content
          .split("\n")
          .filter((l) => l.trim().startsWith("import") && l.includes("from"));

        for (const line of importLines) {
          for (const other of otherDomains) {
            const isDirectImport =
              line.includes(`/apps/${other}/`) &&
              !line.includes("// cherry:allow");
            expect(
              isDirectImport,
              `${rel(file)}: "${other}" domain'inden doğrudan import — internal API kullan`
            ).toBe(false);
          }
        }
      }
    });

    // core/ doğrudan DB erişimi (model dışında)
    it(`${domain}: başka domain'in DB tablosuna doğrudan erişmemeli`, () => {
      const businessFiles = walkFiles(
        join(CONVEX, "apps", domain),
        ".business.ts"
      );
      for (const file of businessFiles) {
        const content = read(file);
        // ctx.db.query("otherDomainTable") pattern'ini yakala
        // Bu yaklaşık kontrol — tam AST analizi olmadan
        // Sadece açık string literal kontrolü
        const tablePattern = /ctx\.db\.(?:query|get|insert|patch|delete|replace)\s*\(\s*["'`](\w+)["'`]/g;
        let match;
        while ((match = tablePattern.exec(content)) !== null) {
          const tableName = match[1]!;
          // Bu domain'in schema'sında tanımlı mı kontrol et
          const domainSchemaFile = join(CONVEX, "apps", domain, `${domain}.schema.ts`);
          if (existsSync(domainSchemaFile)) {
            const schemaContent = read(domainSchemaFile);
            const isOwnTable = schemaContent.includes(`"${tableName}"`) ||
              schemaContent.includes(`'${tableName}'`);
            const isCoreTable = ["scheduledTasks", "cronConfigs", "parameters", "webhookEvents", "auditLogs"].includes(tableName);
            expect(
              isOwnTable || isCoreTable,
              `${rel(file)}: "${tableName}" tablosuna erişim — bu domain'e ait değil`
            ).toBe(true);
          }
        }
      }
    });
  }

  // core/ apps'e bağımlı olmamalı
  it("core/: apps/ import etmemeli", () => {
    const coreFiles = walkFiles(join(CONVEX, "core"), ".ts");
    for (const file of coreFiles) {
      const content = read(file);
      const hasAppsImport = content
        .split("\n")
        .some(
          (l) =>
            l.includes("from") &&
            l.includes("/apps/") &&
            !l.includes("// cherry:allow")
        );
      expect(
        hasAppsImport,
        `${rel(file)}: core/ apps/ import etmiş — core bağımsız olmalı`
      ).toBe(false);
    }
  });
});
```

---

## 7. Modül Yapı Zorunlulukları

```typescript
describe("Modül Yapı Zorunlulukları", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainDir = join(CONVEX, "apps", domain);

    it(`${domain}: .channel.ts dosyası bulunmalı`, () => {
      const exists = existsSync(join(domainDir, `${domain}.channel.ts`));
      expect(
        exists,
        `convex/apps/${domain}/${domain}.channel.ts eksik`
      ).toBe(true);
    });

    it(`${domain}: .business.ts dosyası bulunmalı`, () => {
      const exists = existsSync(join(domainDir, `${domain}.business.ts`));
      expect(
        exists,
        `convex/apps/${domain}/${domain}.business.ts eksik`
      ).toBe(true);
    });

    it(`${domain}: .schema.ts dosyası bulunmalı`, () => {
      const exists = existsSync(join(domainDir, `${domain}.schema.ts`));
      expect(
        exists,
        `convex/apps/${domain}/${domain}.schema.ts eksik`
      ).toBe(true);
    });

    it(`${domain}: schema.ts aggregator'da include edilmeli`, () => {
      const rootSchema = read(join(CONVEX, "schema.ts"));
      const domainSchemaImported = rootSchema.includes(
        `./${domain}/${domain}.schema`
      ) || rootSchema.includes(`./apps/${domain}/${domain}.schema`);
      expect(
        domainSchemaImported,
        `${domain}.schema.ts convex/schema.ts aggregator'a eklenmemiş`
      ).toBe(true);
    });

    // integration.ts — sadece dış API varsa (zorunlu değil ama varsa kurallar uygulanır)
    const integrationFile = join(domainDir, `${domain}.integration.ts`);
    if (existsSync(integrationFile)) {
      it(`${domain}/integration: içinde fetch veya SDK çağrısı bulunmalı`, () => {
        const content = read(integrationFile);
        const hasExternalCall =
          content.includes("fetch(") ||
          content.includes("axios") ||
          content.includes("new Stripe") ||
          content.includes("sendgrid");
        expect(
          hasExternalCall,
          `${domain}.integration.ts dış API çağrısı içermiyor — business'a taşı`
        ).toBe(true);
      });
    }
  }

  // core/ alt modülleri
  const CORE_MODULES = ["schedule", "parameter", "webhook", "audit"];
  for (const mod of CORE_MODULES) {
    it(`core/${mod}: model dosyası bulunmalı`, () => {
      const exists = existsSync(join(CONVEX, "core", mod, `${mod}.model.ts`));
      expect(
        exists,
        `convex/core/${mod}/${mod}.model.ts eksik`
      ).toBe(true);
    });
  }
});
```

---

## 8. Fonksiyon İsimlendirme

```typescript
describe("Fonksiyon İsimlendirme Kuralları", () => {
  // Model fonksiyonları: get/list/exists/count ile başlamalı
  describe("Model: fonksiyon isimleri", () => {
    const modelFiles = walkFiles(join(CONVEX, "model"), ".ts");
    for (const file of modelFiles) {
      it(`${rel(file)}: export edilen fonksiyonlar get/list/exists/count ile başlamalı`, () => {
        const content = read(file);
        const names = extractExportedNames(content);
        for (const name of names) {
          expect(
            name,
            `model fonksiyonu "${name}" get/list/exists/count ile başlamıyor`
          ).toMatch(/^(get|list|exists|count|find)/);
        }
      });
    }
  });

  // Batch dosyaları: batch ile başlamalı
  describe("Batch: fonksiyon isimleri", () => {
    const batchFiles = walkFiles(join(CONVEX, "apps"), ".batch.ts");
    for (const file of batchFiles) {
      it(`${rel(file)}: export edilen fonksiyonlar 'batch' ile başlamalı`, () => {
        const content = read(file);
        const names = extractExportedNames(content);
        for (const name of names) {
          expect(
            name,
            `batch fonksiyonu "${name}" 'batch' ile başlamıyor`
          ).toMatch(/^batch/);
        }
      });
    }
  });

  // Hook dosyaları: use ile başlamalı
  describe("Frontend Hooks: fonksiyon ismi", () => {
    const hookFiles = walkFiles(join(APP, "features"), ".ts").filter((f) =>
      f.includes("/hooks/")
    );
    for (const file of hookFiles) {
      it(`${rel(file)}: tek export ve 'use' ile başlamalı`, () => {
        const content = read(file);
        const names = extractExportedNames(content);
        expect(names.length).toBeGreaterThanOrEqual(1);
        for (const name of names) {
          expect(
            name,
            `hook "${name}" use ile başlamıyor`
          ).toMatch(/^use[A-Z]/);
        }
      });
    }
  });
});
```

---

## 9. Schema Kuralları

```typescript
describe("Schema Kuralları", () => {
  // Her domain schema'sı {domain}Tables export etmeli
  const domains = getDomains();
  for (const domain of domains) {
    const schemaFile = join(CONVEX, "apps", domain, `${domain}.schema.ts`);
    if (!existsSync(schemaFile)) continue;

    it(`${domain}.schema.ts: ${domain}Tables export etmeli`, () => {
      const content = read(schemaFile);
      const exportsTable = content.includes(`export const ${domain}Tables`);
      expect(
        exportsTable,
        `${domain}.schema.ts: "export const ${domain}Tables" bulunamadı`
      ).toBe(true);
    });

    it(`${domain}.schema.ts: field tanımlarını export etmeli`, () => {
      const content = read(schemaFile);
      const hasFieldExport = content.includes("export const") &&
        content.includes("Fields");
      expect(
        hasFieldExport,
        `${domain}.schema.ts: *Fields export'u bulunamadı — validator reuse için gerekli`
      ).toBe(true);
    });
  }

  // Root schema.ts sadece import ve defineSchema içermeli
  it("schema.ts: tablo tanımı içermemeli (sadece import + defineSchema)", () => {
    const content = read(join(CONVEX, "schema.ts"));
    const hasDirectTable = hasLine(content, /defineTable\s*\(/);
    expect(
      hasDirectTable,
      "schema.ts doğrudan defineTable() içeriyor — tablo tanımları domain schema dosyalarına taşınmalı"
    ).toBe(false);
  });
});
```

---

## 10. Frontend Kuralları

```typescript
describe("Frontend Kuralları", () => {
  // Route dosyaları: loader + component dışında inline mantık yok
  const routeFiles = walkFiles(join(APP, "routes"), ".tsx");
  for (const file of routeFiles) {
    if (basename(file) === "__root.tsx") continue; // root muaf

    it(`${rel(file)}: useState kullanmamalı (state features/'ta olmalı)`, () => {
      const content = read(file);
      const hasState = content.includes("useState(");
      expect(
        hasState,
        `${rel(file)}: useState bulundu — state yönetimi features/ bileşenlerine taşı`
      ).toBe(false);
    });

    it(`${rel(file)}: useEffect kullanmamalı`, () => {
      const content = read(file);
      const hasEffect = content.includes("useEffect(");
      expect(
        hasEffect,
        `${rel(file)}: useEffect bulundu — side effects features/ hooks'larına taşı`
      ).toBe(false);
    });
  }

  // Componentler: convexQuery doğrudan kullanmamalı (hook'ta olmalı)
  const componentFiles = walkFiles(join(APP, "features"), ".tsx").filter(
    (f) => f.includes("/components/")
  );
  for (const file of componentFiles) {
    it(`${rel(file)}: convexQuery doğrudan kullanmamalı`, () => {
      const content = read(file);
      const hasDirectQuery = content.includes("convexQuery(") &&
        !content.includes("// cherry:allow");
      expect(
        hasDirectQuery,
        `${rel(file)}: convexQuery doğrudan component'te kullanılmış — hooks/ dosyasına taşı`
      ).toBe(false);
    });

    it(`${rel(file)}: api import etmemeli (hooks aracılığıyla)`, () => {
      const content = read(file);
      const hasApiImport = content.includes(
        'from "../../../../convex/_generated/api"'
      ) || content.includes('from "../../../convex/_generated/api"');
      expect(
        hasApiImport,
        `${rel(file)}: component api import ediyor — hook aracılığıyla kullan`
      ).toBe(false);
    });
  }
});
```

---

## 11. Test Varlığı

```typescript
describe("Test Varlığı Zorunlulukları", () => {
  const domains = getDomains();

  for (const domain of domains) {
    const domainDir = join(CONVEX, "apps", domain);
    const businessFile = join(domainDir, `${domain}.business.ts`);
    const testFile = join(domainDir, `${domain}.business.test.ts`);

    if (!existsSync(businessFile)) continue;

    it(`${domain}: .business.test.ts dosyası bulunmalı`, () => {
      expect(
        existsSync(testFile),
        `convex/apps/${domain}/${domain}.business.test.ts eksik`
      ).toBe(true);
    });

    if (existsSync(testFile)) {
      it(`${domain}: test dosyasında en az 2 test bulunmalı`, () => {
        const content = read(testFile);
        const testCount = (content.match(/\btest\s*\(|\bit\s*\(/g) ?? []).length;
        expect(
          testCount,
          `${domain}.business.test.ts: ${testCount} test bulundu (minimum: 2)`
        ).toBeGreaterThanOrEqual(2);
      });
    }
  }
});
```

---

## 12. lib/ Bütünlüğü

```typescript
describe("lib/ Dosya Bütünlüğü", () => {
  it("lib/functions.ts: tüm zorunlu wrapper'ları export etmeli", () => {
    const content = read(join(CONVEX, "lib", "functions.ts"));
    const REQUIRED = [
      "publicQuery", "publicMutation",
      "authenticatedQuery", "authenticatedMutation",
      "adminQuery", "adminMutation",
      "rateLimitedMutation", "activeSystemMutation",
      "internalAuthQuery", "internalAuthMutation",
    ];
    for (const name of REQUIRED) {
      expect(
        content,
        `lib/functions.ts: "export const ${name}" bulunamadı`
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
});
```

---

## Vitest Konfigürasyonu

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/**/*.test.ts",           // architectural testler
      "convex/**/*.business.test.ts", // business unit testler
      "convex/**/*.channel.test.ts",  // channel integration testler
    ],
    coverage: {
      include: ["convex/apps/**/*.business.ts"],
      thresholds: { branches: 80, functions: 90, lines: 85 },
    },
  },
});
```

## Pre-Push Hook

```bash
# .husky/pre-push
#!/bin/sh
echo "🏗️  Architectural tests..."
pnpm test:arch || exit 1
echo "🔷  TypeScript..."
pnpm typecheck || exit 1
echo "✅  OK"
```

```json
// package.json
{
  "scripts": {
    "test:arch": "vitest run tests/architecture.test.ts",
    "test:unit": "vitest run convex/**/*.business.test.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 13. Rate Limit Zorunluluğu

Her channel mutation, rate-limited bir wrapper kullanmak zorundadır.
`authenticatedMutation` veya `adminMutation` doğrudan channel'da kullanılamaz.

```typescript
describe("Rate Limit Zorunluluğu", () => {
  // Rate limit içeren onaylı wrapper'lar (lib/rate-limiter.md'den)
  const RATE_LIMITED_WRAPPERS = [
    "strictMutation",
    "normalMutation",
    "relaxedMutation",
    "burstMutation",
    "adminRateLimitedMutation",
    "publicStrictMutation",
    // Domain-spesifik — buraya ekle
    "tradingMutation",
    "paymentMutation",
  ];

  // Rate limit içermeyen — channel'da export'ta kullanılamaz
  const FORBIDDEN_DIRECT_IN_CHANNEL = [
    "authenticatedMutation",
    "adminMutation",
    "publicMutation",
  ];

  const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");

  for (const file of channelFiles) {
    describe(`${rel(file)}`, () => {
      const content = read(file);
      const exportedMutations = [...content.matchAll(
        /^export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/gm
      )];

      // Mutation export'larını filtrele (query'ler muaf)
      const mutationExports = exportedMutations.filter(([, , wrapper]) => {
        // Query wrapper'larını dışla
        const isQuery = wrapper?.includes("Query") || wrapper?.includes("query");
        return !isQuery;
      });

      for (const [fullMatch, name, wrapper] of mutationExports) {
        it(`export "${name}": rate-limited wrapper kullanmalı`, () => {
          const isBypassed = content
            .split("\n")
            .some((l) => l.includes(name!) && l.includes("// cherry:allow-no-rate-limit"));

          if (!isBypassed) {
            expect(
              RATE_LIMITED_WRAPPERS,
              `"${name}" rate-limited wrapper kullanmıyor (kullanılan: "${wrapper}") — ` +
              `strictMutation / normalMutation / relaxedMutation / burstMutation kullan`
            ).toContain(wrapper);
          }
        });

        it(`export "${name}": forbidden wrapper kullanmamalı`, () => {
          expect(
            FORBIDDEN_DIRECT_IN_CHANNEL,
            `"${name}" doğrudan "${wrapper}" kullanıyor — rate-limited wrapper kullan`
          ).not.toContain(wrapper);
        });
      }
    });
  }
});
```

---

## 14. Shared Infrastructure Anti-Pattern

Shared infrastructure'ın yokken kullanılması gereken durumlarda detect eder.
Bu testler hem hard fail (kural ihlali) hem advisory warning içerir.

```typescript
describe("Shared Infrastructure Anti-Pattern", () => {
  // ── HARD FAIL ────────────────────────────────────────────────────────────────

  describe("[FAIL] .collect().length — aggregate kullan", () => {
    const files = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".test.ts")
    );
    for (const file of files) {
      it(`${rel(file)}: .collect().length kullanmamalı`, () => {
        const content = read(file);
        const hasCountAntiPattern = /\.collect\(\)\s*\.length/.test(content) ||
          /\.collect\(\)\s*\n\s*\.(length|filter|map)/.test(content);
        expect(
          hasCountAntiPattern,
          `${rel(file)}: .collect().length bulundu — tradeCountAggregate.count() kullan`
        ).toBe(false);
      });
    }
  });

  describe("[FAIL] Promise.all(ids.map(ctx.db.get)) — getAll() kullan", () => {
    const files = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".test.ts")
    );
    for (const file of files) {
      it(`${rel(file)}: Promise.all(ids.map(ctx.db.get)) kullanmamalı`, () => {
        const content = read(file);
        const hasRelAntiPattern =
          content.includes("Promise.all") &&
          content.includes("ctx.db.get") &&
          content.includes(".map(");
        expect(
          hasRelAntiPattern,
          `${rel(file)}: Promise.all(ids.map(ctx.db.get)) — getAll() from lib/relationships.ts kullan`
        ).toBe(false);
      });
    }
  });

  describe("[FAIL] fetch() sadece integration dosyalarında", () => {
    const nonIntegrationFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".integration.ts") && !f.includes(".test.ts")
    );
    for (const file of nonIntegrationFiles) {
      it(`${rel(file)}: fetch() kullanmamalı`, () => {
        const content = read(file);
        const lines_ = content.split("\n");
        const hasFetch = lines_.some(
          (l) => /\bfetch\s*\(/.test(l) && !l.includes("// cherry:allow")
        );
        expect(
          hasFetch,
          `${rel(file)}: fetch() bulundu — dış API çağrıları .integration.ts dosyasına taşı`
        ).toBe(false);
      });
    }
  });

  describe("[FAIL] ctx.db.insert('auditLogs') — ctx.audit.log() kullan", () => {
    const appFiles = walkFiles(join(CONVEX, "apps"), ".ts").filter(
      (f) => !f.includes(".test.ts")
    );
    for (const file of appFiles) {
      it(`${rel(file)}: auditLogs'a direkt insert etmemeli`, () => {
        const content = read(file);
        const hasDirectAuditInsert =
          content.includes('"auditLogs"') &&
          content.includes("ctx.db.insert") &&
          !content.includes("// cherry:allow");
        expect(
          hasDirectAuditInsert,
          `${rel(file)}: ctx.db.insert("auditLogs") bulundu — ctx.audit.log() kullan`
        ).toBe(false);
      });
    }
  });

  describe("[FAIL] ctx.scheduler.runAfter() channel'da yasak", () => {
    const channelFiles = walkFiles(join(CONVEX, "apps"), ".channel.ts");
    for (const file of channelFiles) {
      it(`${rel(file)}: scheduler doğrudan kullanmamalı`, () => {
        const content = read(file);
        const hasScheduler = content.includes("ctx.scheduler") &&
          !content.includes("// cherry:allow");
        expect(
          hasScheduler,
          `${rel(file)}: ctx.scheduler bulundu — scheduleTask() from core/schedule kullan`
        ).toBe(false);
      });
    }
  });

  describe("[FAIL] throw new Error() yasak", () => {
    const backendFiles = [
      ...walkFiles(join(CONVEX, "apps"), ".ts"),
      ...walkFiles(join(CONVEX, "core"), ".ts"),
    ].filter((f) => !f.includes(".test.ts") && !f.includes(".schema.ts"));

    for (const file of backendFiles) {
      it(`${rel(file)}: throw new Error() kullanmamalı`, () => {
        const content = read(file);
        const hasBareThrow = content
          .split("\n")
          .some((l) =>
            l.trim().includes("throw new Error(") &&
            !l.includes("// cherry:allow")
          );
        expect(
          hasBareThrow,
          `${rel(file)}: throw new Error() — errors.* factory kullan`
        ).toBe(false);
      });
    }
  });

  // ── ADVISORY WARNING (fail değil — console.warn) ──────────────────────────

  describe("[ADVISORY] Workflow candidate detection", () => {
    const businessFiles = walkFiles(join(CONVEX, "apps"), ".business.ts");
    const candidates: string[] = [];

    for (const file of businessFiles) {
      it(`${rel(file)}: çok fazla scheduler.runAfter varsa workflow önerilir`, () => {
        const content = read(file);
        const schedulerCalls = (content.match(/ctx\.scheduler\.runAfter/g) ?? []).length;
        if (schedulerCalls >= 3) {
          candidates.push(`${rel(file)}: ${schedulerCalls} scheduler.runAfter çağrısı — @convex-dev/workflow düşün`);
        }
        // Advisory — fail değil
        if (candidates.length > 0 && file === businessFiles[businessFiles.length - 1]) {
          console.warn("\n⚠️  Workflow Candidates:\n" + candidates.join("\n"));
        }
      });
    }
  });

  describe("[ADVISORY] Retrier olmadan integration action", () => {
    const integrationFiles = walkFiles(join(CONVEX, "apps"), ".integration.ts");

    for (const file of integrationFiles) {
      it(`${rel(file)}: fetch sonrası hata yönetimi retrier ile yapılmalı`, () => {
        const content = read(file);
        const hasFetch = content.includes("fetch(");
        const hasRetrier = content.includes("retrier.run(") || content.includes("retrier.runWithRetry(");
        const hasTryCatchScheduler =
          content.includes("catch") && content.includes("scheduler.runAfter");

        if (hasFetch && hasTryCatchScheduler && !hasRetrier) {
          console.warn(
            `⚠️  ${rel(file)}: try/catch + scheduler retry pattern — retrier.run() kullan`
          );
        }
        // Advisory — fail değil
      });
    }
  });
});
```

---

## 15. lib/ Wrapper Bütünlüğü

`APPROVED_CHANNEL_MUTATION_WRAPPERS` listesiyle sync kontrolü.
`lib/functions.ts`'e yeni wrapper eklendiğinde bu test uyarı verir.

```typescript
describe("lib/ Wrapper Bütünlüğü", () => {
  // Canonical approved list — rate-limiter.md ile sync tutulmalı
  const CANONICAL_RATE_LIMITED_WRAPPERS = [
    "strictMutation",
    "normalMutation",
    "relaxedMutation",
    "burstMutation",
    "adminRateLimitedMutation",
    "publicStrictMutation",
  ];

  it("lib/functions.ts: tüm rate-limited wrapper'lar export edilmeli", () => {
    const content = read(join(CONVEX, "lib", "functions.ts"));
    for (const wrapper of CANONICAL_RATE_LIMITED_WRAPPERS) {
      expect(
        content,
        `lib/functions.ts: "export const ${wrapper}" bulunamadı`
      ).toContain(`export const ${wrapper}`);
    }
  });

  it("lib/rate-limiter.ts: tüm wrapper'ların rate limit config'i tanımlı olmalı", () => {
    const rateLimiterContent = read(join(CONVEX, "lib", "rate-limiter.ts"));
    const functionsContent = read(join(CONVEX, "lib", "functions.ts"));

    // functions.ts'teki rateLimiter.limit(ctx, "X", ...) çağrılarını bul
    const usedConfigs = [...functionsContent.matchAll(
      /rateLimiter\.limit\(ctx,\s*["'](\w[\w-]*)["']/g
    )].map((m) => m[1]!);

    // Her kullanılan config rate-limiter.ts'te tanımlı mı?
    for (const config of usedConfigs) {
      expect(
        rateLimiterContent,
        `lib/rate-limiter.ts: "${config}" config tanımlanmamış`
      ).toContain(`"${config}"`);
    }
  });

  it("lib/functions.ts: zorunlu tüm wrapper'ları export etmeli", () => {
    const content = read(join(CONVEX, "lib", "functions.ts"));
    const REQUIRED_ALL = [
      // Auth wrappers
      "publicQuery", "publicMutation", "publicAction",
      "authenticatedQuery", "authenticatedMutation", "authenticatedAction",
      "adminQuery", "adminMutation",
      // Rate limited wrappers
      ...CANONICAL_RATE_LIMITED_WRAPPERS,
      // Internal wrappers
      "internalAuthQuery", "internalAuthMutation", "internalAuthAction",
    ];

    for (const name of REQUIRED_ALL) {
      expect(
        content,
        `lib/functions.ts: "export const ${name}" bulunamadı`
      ).toContain(`export const ${name}`);
    }
  });
});
```

---

## Bypass Mekanizması

Nadir istisnalar için `// cherry:allow` yorumu testi atlatır.
PR'da neden gerekli olduğu açıklanmalıdır.

```typescript
const legacyQuery = query({ ... }); // cherry:allow — migration sırasında geçici
throw new Error("impossible state"); // cherry:allow — TypeScript exhaustiveness
```

Rate limit bypass için özel yorum:

```typescript
// cherry:allow-no-rate-limit — public health check, rate limit gereksiz
export const ping = publicQuery({
  args: {},
  handler: async () => ({ ok: true }),
});
```
