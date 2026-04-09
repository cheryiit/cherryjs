import { v } from "convex/values";
import { adminQuery } from "../../lib/functions";
import { internal } from "../../_generated/api";
import {
  listEmailLogsByRecipient,
  listEmailLogsByTemplate,
} from "./notificationsModel";

export const listByRecipient = adminQuery({
  args: {
    to: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { to, limit }) => {
    return listEmailLogsByRecipient(ctx, to, limit);
  },
});

export const listByTemplate = adminQuery({
  args: {
    template: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { template, limit }) => {
    return listEmailLogsByTemplate(ctx, template, limit);
  },
});
