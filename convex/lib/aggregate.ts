// @ts-nocheck — Convex issue #53: TS2589 on large schemas.
/**
 * Aggregate component instance.
 *
 * Provides efficient O(log n) count and sum operations over any Convex
 * table without scanning all rows. Two flavors:
 *
 * ## TableAggregate (recommended)
 *
 * Automatically stays in sync with a table via convex-helpers Triggers.
 * Define a `sortKey` function that extracts the ordering key from each
 * document, register its trigger, and then read counts/sums instantly.
 *
 * ```ts
 * // In any business/model file:
 * import { TableAggregate } from "@convex-dev/aggregate";
 * import { components } from "../../_generated/api";
 * import type { DataModel } from "../../_generated/dataModel";
 *
 * export const usersByRole = new TableAggregate<{
 *   Key: string;
 *   DataModel: DataModel;
 *   TableName: "users";
 * }>(components.aggregate, {
 *   sortKey: (d) => d.role,
 * });
 *
 * // Register the trigger in convex/triggers.ts:
 * triggers.register("users", usersByRole.trigger());
 *
 * // Read count in any query:
 * const adminCount = await usersByRole.count(ctx, {
 *   bounds: { lower: { key: "admin", inclusive: true },
 *             upper: { key: "admin", inclusive: true } },
 * });
 * ```
 *
 * ## DirectAggregate
 *
 * Manual insert/delete — useful when you need aggregates over data that
 * doesn't map 1:1 to a table row (e.g., event counts, time-window
 * metrics, custom histograms).
 *
 * ```ts
 * import { DirectAggregate } from "@convex-dev/aggregate";
 * import { components } from "../../_generated/api";
 *
 * export const dailySignups = new DirectAggregate<{
 *   Key: string;  // "2026-04-09"
 *   Id: string;   // unique event id
 * }>(components.aggregate);
 *
 * // Insert from a mutation:
 * await dailySignups.insert(ctx, {
 *   key: new Date().toISOString().slice(0, 10),
 *   id: eventId,
 *   sumValue: 1,
 * });
 *
 * // Count all signups today:
 * const todayCount = await dailySignups.count(ctx, {
 *   bounds: { lower: { key: today, inclusive: true },
 *             upper: { key: today, inclusive: true } },
 * });
 * ```
 *
 * ## Important: namespace isolation
 *
 * If multiple aggregates share the same component instance, use the
 * `Namespace` generic parameter to keep them separate:
 *
 * ```ts
 * new TableAggregate<{ Key: string; DataModel: DataModel;
 *   TableName: "users"; Namespace: string; }>(components.aggregate, {
 *   sortKey: (d) => d.role,
 *   namespace: (d) => "users-by-role",
 * });
 * ```
 *
 * Without namespaces, all aggregates would share a single B-tree,
 * causing data overlap and contention.
 */
export { Aggregate, DirectAggregate, TableAggregate } from "@convex-dev/aggregate";
export { components } from "../_generated/api";
