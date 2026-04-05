import type { QueryCtx, MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export async function getScheduledTaskByIdempotency(
  ctx: QueryCtx,
  idempotencyKey: string,
) {
  return ctx.db
    .query("scheduledTasks")
    .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
    .first();
}

export async function getScheduledTaskByName(
  ctx: QueryCtx,
  name: string,
  status?: "pending" | "running" | "completed" | "failed" | "cancelled",
) {
  if (status) {
    return ctx.db
      .query("scheduledTasks")
      .withIndex("by_name", (q) => q.eq("name", name).eq("status", status))
      .first();
  }
  return ctx.db
    .query("scheduledTasks")
    .withIndex("by_name", (q) => q.eq("name", name))
    .first();
}

export async function listScheduledTasksByStatus(
  ctx: QueryCtx,
  status: "pending" | "running" | "completed" | "failed" | "cancelled",
) {
  return ctx.db
    .query("scheduledTasks")
    .withIndex("by_status", (q) => q.eq("status", status))
    .collect();
}

export async function getCronConfig(ctx: QueryCtx, name: string) {
  return ctx.db
    .query("cronConfigs")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

export async function listCronConfigs(ctx: QueryCtx) {
  return ctx.db.query("cronConfigs").collect();
}
