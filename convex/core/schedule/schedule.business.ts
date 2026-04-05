import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getScheduledTaskByIdempotency,
  getCronConfig,
  listCronConfigs,
  listScheduledTasksByStatus,
} from "./schedule.model";

export const scheduleTask = internalMutation({
  args: {
    name: v.string(),
    functionReference: v.string(),
    args: v.optional(v.any()),
    delayMs: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, { name, functionReference, args: taskArgs, delayMs, idempotencyKey }) => {
    if (idempotencyKey) {
      const existing = await getScheduledTaskByIdempotency(ctx, idempotencyKey);
      if (existing && (existing.status === "pending" || existing.status === "running")) {
        return existing._id;
      }
    }

    const convexScheduleId = await ctx.scheduler.runAfter(
      delayMs ?? 0,
      functionReference as any,
      taskArgs ?? {},
    );

    return ctx.db.insert("scheduledTasks", {
      name,
      functionReference,
      args: taskArgs,
      convexScheduleId,
      status: "pending",
      idempotencyKey,
      scheduledAt: Date.now(),
    });
  },
});

export const cancelTask = internalMutation({
  args: {
    taskId: v.id("scheduledTasks"),
  },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw errors.notFound("ScheduledTask", taskId);
    if (task.status !== "pending") {
      throw errors.validation(`Cannot cancel task with status: ${task.status}`);
    }

    await ctx.scheduler.cancel(task.convexScheduleId);
    await ctx.db.patch(taskId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

export const completeTask = internalMutation({
  args: {
    taskId: v.id("scheduledTasks"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, error }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return;

    await ctx.db.patch(taskId, {
      status: error ? "failed" : "completed",
      completedAt: Date.now(),
      error,
    });
  },
});

// ── Cron Management ───────────────────────────────────────────────────────────

export const listCrons = internalQuery({
  args: {},
  handler: async (ctx) => {
    return listCronConfigs(ctx);
  },
});

export const toggleCron = internalMutation({
  args: {
    name: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { name, enabled }) => {
    const config = await getCronConfig(ctx, name);
    if (!config) throw errors.notFound("CronConfig", name);

    await ctx.db.patch(config._id, {
      enabled,
      disabledAt: enabled ? undefined : Date.now(),
      disabledReason: enabled ? undefined : "Manually disabled",
      consecutiveFailures: enabled ? 0 : config.consecutiveFailures,
    });
  },
});

export const registerCronFailure = internalMutation({
  args: {
    name: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { name, error }) => {
    const config = await getCronConfig(ctx, name);
    if (!config) return;

    const failures = config.consecutiveFailures + 1;
    const shouldDisable = failures >= config.maxFailuresBeforeDisable;

    await ctx.db.patch(config._id, {
      consecutiveFailures: failures,
      lastRunAt: Date.now(),
      lastError: error,
      ...(shouldDisable
        ? {
            enabled: false,
            disabledAt: Date.now(),
            disabledReason: `Auto-disabled after ${failures} consecutive failures`,
          }
        : {}),
    });
  },
});

export const registerCronSuccess = internalMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const config = await getCronConfig(ctx, name);
    if (!config) return;

    await ctx.db.patch(config._id, {
      consecutiveFailures: 0,
      lastRunAt: Date.now(),
      lastError: undefined,
    });
  },
});

export const seedCronConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { name: "daily-audit-cleanup", maxFailuresBeforeDisable: 3 },
      { name: "daily-session-cleanup", maxFailuresBeforeDisable: 3 },
    ];

    for (const cron of defaults) {
      const existing = await getCronConfig(ctx, cron.name);
      if (!existing) {
        await ctx.db.insert("cronConfigs", {
          name: cron.name,
          enabled: true,
          consecutiveFailures: 0,
          maxFailuresBeforeDisable: cron.maxFailuresBeforeDisable,
        });
      }
    }
  },
});
