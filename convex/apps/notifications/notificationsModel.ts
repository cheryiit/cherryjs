import type { QueryCtx } from "../../_generated/server";

export async function listEmailLogsByRecipient(
  ctx: QueryCtx,
  to: string,
  limit = 20,
) {
  return ctx.db
    .query("emailLogs")
    .withIndex("by_to", (q) => q.eq("to", to))
    .order("desc")
    .take(limit);
}

export async function listEmailLogsByTemplate(
  ctx: QueryCtx,
  template: string,
  limit = 50,
) {
  return ctx.db
    .query("emailLogs")
    .withIndex("by_template", (q) => q.eq("template", template))
    .order("desc")
    .take(limit);
}
