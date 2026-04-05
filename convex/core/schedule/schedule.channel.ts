import { v } from "convex/values";
import { adminQuery, adminRateLimitedMutation } from "../../lib/functions";
import { internal } from "../../_generated/api";

export const listCrons = adminQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.core.schedule.scheduleBusiness.listCrons,
      {},
    );
  },
});

export const toggleCron = adminRateLimitedMutation({
  args: {
    name: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { name, enabled }) => {
    await ctx.runMutation(
      internal.core.schedule.scheduleBusiness.toggleCron,
      { name, enabled },
    );

    await ctx.audit.log({
      action: enabled ? "cron.enable" : "cron.disable",
      resourceType: "cronConfig",
      resourceId: name,
    });
  },
});

export const cancelTask = adminRateLimitedMutation({
  args: {
    taskId: v.id("scheduledTasks"),
  },
  handler: async (ctx, { taskId }) => {
    await ctx.runMutation(
      internal.core.schedule.scheduleBusiness.cancelTask,
      { taskId },
    );

    await ctx.audit.warn({
      action: "schedule.cancel",
      resourceType: "scheduledTask",
      resourceId: taskId,
    });
  },
});
