// @ts-nocheck — Convex issue #53: TS2589 on convex-helpers/validators
// generic re-exports once schema crosses ~10 tables. Runtime is fine.
import { v } from "convex/values";
export { literals, nullable, partial } from "convex-helpers/validators";

export const paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
});

export const timestampValidator = v.number();

export const emailValidator = v.string();

export const urlValidator = v.string();
