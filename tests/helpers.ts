/**
 * Shared Test Helpers
 *
 * Common utilities used across all architectural test files.
 * Avoids duplication of walkFiles, read, rel, etc.
 */
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from "fs";
import { join, relative, basename } from "path";

export const ROOT = process.cwd();
export const CONVEX = join(ROOT, "convex");
export const APP = join(ROOT, "app");

export function walkFiles(dir: string, ext?: string): string[] {
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

export function read(path: string): string {
  return readFileSync(path, "utf-8");
}

export function lineCount(content: string): number {
  return content.split("\n").length;
}

export function rel(path: string): string {
  return relative(ROOT, path);
}

export function hasLine(content: string, pattern: RegExp): boolean {
  return content.split("\n").some((l) => pattern.test(l));
}

/**
 * Returns active domain directory names under `convex/apps/`.
 * Excludes `_template` (scaffolding reference, not a live domain).
 */
export function getDomains(): string[] {
  const appsDir = join(CONVEX, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter(
    (d) =>
      statSync(join(appsDir, d)).isDirectory() &&
      !d.startsWith("_"),
  );
}

/**
 * Returns subdirectory names under `dir`.
 * Excludes `_`-prefixed dirs (templates, generated).
 */
export function getDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (d) => statSync(join(dir, d)).isDirectory() && !d.startsWith("_"),
  );
}

export function extractExportedNames(content: string): string[] {
  const names: string[] = [];
  const matches = content.matchAll(
    /export\s+(?:const|function|async function)\s+(\w+)/g,
  );
  for (const m of matches) {
    names.push(m[1]!);
  }
  return names;
}

export function extractHandlerLineCounts(content: string): number[] {
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

// ── Approved Constants ───────────────────────────────────────────────────────

export const APPROVED_CONVEX_SUFFIXES = [
  "Channel.ts",
  "Business.ts",
  "Integration.ts",
  "Model.ts",
  "Workflow.ts",
  "Schedule.ts",
  "Batch.ts",
  "Schema.ts",
  ".test.ts",
  "Http.ts",
  "Middleware.ts",
];

export const APPROVED_QUERY_WRAPPERS = [
  "publicQuery",
  "authenticatedQuery",
  "adminQuery",
];

export const RATE_LIMITED_MUTATION_WRAPPERS = [
  "strictMutation",
  "normalMutation",
  "relaxedMutation",
  "burstMutation",
  "adminRateLimitedMutation",
  "publicStrictMutation",
  "activeSystemMutation",
  "verifiedUserMutation",
];

export const FORBIDDEN_DIRECT_MUTATION_WRAPPERS = [
  "authenticatedMutation",
  "adminMutation",
  "publicMutation",
];

export const ALL_APPROVED_CHANNEL_WRAPPERS = [
  ...APPROVED_QUERY_WRAPPERS,
  ...RATE_LIMITED_MUTATION_WRAPPERS,
  "publicAction",
  "authenticatedAction",
];
