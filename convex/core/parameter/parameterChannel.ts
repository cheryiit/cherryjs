// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
import { v } from "convex/values";
import { adminQuery, adminRateLimitedMutation } from "../../lib/functions";
import { internal } from "../../_generated/api";

/** @admin */
export const list = adminQuery({
  args: {
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { domain }) => {
    return ctx.runQuery(internal.core.parameter.parameterBusiness.list, {
      domain,
    });
  },
});

/** @admin @critical */
export const set = adminRateLimitedMutation({
  args: {
    key: v.string(),
    value: v.any(),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { key, value, domain, description }) => {
    const id = await ctx.runMutation(
      internal.core.parameter.parameterBusiness.set,
      {
        key,
        value,
        domain,
        description,
        updatedBy: ctx.user._id,
      },
    );

    await ctx.audit.log({
      action: "parameter.set",
      resourceType: "parameter",
      resourceId: key,
      details: { domain, value },
    });

    return id;
  },
});

/** @admin @critical */
export const remove = adminRateLimitedMutation({
  args: {
    key: v.string(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { key, domain }) => {
    await ctx.runMutation(
      internal.core.parameter.parameterBusiness.remove,
      { key, domain },
    );

    await ctx.audit.warn({
      action: "parameter.delete",
      resourceType: "parameter",
      resourceId: key,
      details: { domain },
    });
  },
});