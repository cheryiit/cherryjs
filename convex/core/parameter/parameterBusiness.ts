// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) triggers on v.* calls with large aggregated schemas. Runtime is validated by Convex's schema validators. Business logic worth type-checking lives in *Model.ts.
import { businessMutation, businessQuery } from "../../lib/functions";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import {
  getParameter,
  listParametersByDomain,
} from "./parameterModel";

export const get = businessQuery({
  args: {
    key: v.string(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { key, domain }) => {
    return getParameter(ctx, key, domain);
  },
});

export const list = businessQuery({
  args: {
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { domain }) => {
    return listParametersByDomain(ctx, domain);
  },
});

export const set = businessMutation({
  args: {
    key: v.string(),
    value: v.any(),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, { key, value, domain, description, updatedBy }) => {
    const existing = await getParameter(ctx, key, domain);

    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        description: description ?? existing.description,
        updatedBy,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("parameters", {
      domain,
      key,
      value,
      description,
      updatedBy,
      updatedAt: Date.now(),
    });
  },
});

export const remove = businessMutation({
  args: {
    key: v.string(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { key, domain }) => {
    const existing = await getParameter(ctx, key, domain);
    if (!existing) throw errors.notFound("Parameter", key);
    await ctx.db.delete(existing._id);
  },
});

export const seed = businessMutation({
  args: {},
  handler: async (ctx) => {
    const defaults: Array<{
      key: string;
      value: unknown;
      domain?: string;
      description: string;
    }> = [
      {
        key: "maintenance-mode",
        value: false,
        description: "Global maintenance mode flag",
      },
      {
        key: "max-upload-size-mb",
        value: 10,
        description: "Maximum file upload size in MB",
      },
    ];

    for (const param of defaults) {
      const existing = await getParameter(ctx, param.key, param.domain);
      if (!existing) {
        await ctx.db.insert("parameters", {
          ...param,
          updatedAt: Date.now(),
        });
      }
    }
  },
});