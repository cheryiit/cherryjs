// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively deep) on large aggregated schemas. Runtime is validated by Convex's schema validators and our architectural tests.
import type { QueryCtx, MutationCtx } from "../../_generated/server";

export async function getParameter(
  ctx: QueryCtx,
  key: string,
  domain?: string,
) {
  return ctx.db
    .query("parameters")
    .withIndex("by_domain_key", (q: any) =>
      q.eq("domain", domain).eq("key", key),
    )
    .unique();
}

export async function getNumberParameter(
  ctx: QueryCtx,
  key: string,
  defaultValue: number,
  domain?: string,
): Promise<number> {
  const param = await getParameter(ctx, key, domain);
  if (!param || typeof param.value !== "number") return defaultValue;
  return param.value;
}

export async function getBooleanParameter(
  ctx: QueryCtx,
  key: string,
  defaultValue: boolean,
  domain?: string,
): Promise<boolean> {
  const param = await getParameter(ctx, key, domain);
  if (!param || typeof param.value !== "boolean") return defaultValue;
  return param.value;
}

export async function getStringParameter(
  ctx: QueryCtx,
  key: string,
  defaultValue: string,
  domain?: string,
): Promise<string> {
  const param = await getParameter(ctx, key, domain);
  if (!param || typeof param.value !== "string") return defaultValue;
  return param.value;
}

export async function listParametersByDomain(
  ctx: QueryCtx,
  domain?: string,
) {
  return ctx.db
    .query("parameters")
    .withIndex("by_domain_key", (q: any) => q.eq("domain", domain))
    .collect();
}