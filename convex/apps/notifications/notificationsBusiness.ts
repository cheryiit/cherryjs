// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import {
  listEmailLogsByRecipient,
  listEmailLogsByTemplate,
} from "./notificationsModel";
import { emailLogFields } from "./notificationsSchema";

// `sentAt` is set by the mutation handler — exclude from input args
const { sentAt: _sentAt, ...emailLogInputFields } = emailLogFields;

export const logEmail = businessMutation({
  args: emailLogInputFields,
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", { ...args, sentAt: Date.now() });
  },
});

export const listByRecipient = businessQuery({
  args: {
    to: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { to, limit }) => {
    return listEmailLogsByRecipient(ctx, to, limit);
  },
});

export const listByTemplate = businessQuery({
  args: {
    template: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { template, limit }) => {
    return listEmailLogsByTemplate(ctx, template, limit);
  },
});