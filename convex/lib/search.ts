import type { QueryCtx } from "../_generated/server";

/**
 * Search text across a table using Convex search index.
 *
 * Usage:
 * ```ts
 * const results = await searchText(ctx, "users", "search_name", query, 20);
 * ```
 */
export async function searchText<TableName extends string>(
  ctx: QueryCtx,
  table: TableName,
  searchIndex: string,
  query: string,
  limit = 20,
) {
  if (!query.trim()) return [];

  return (ctx.db as any)
    .query(table)
    .withSearchIndex(searchIndex, (q: any) => q.search("*", query))
    .take(limit);
}
