import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const requestMetaValidator = v.optional(
  v.object({
    userAgent: v.optional(v.string()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  }),
);

export type RequestMeta = {
  userAgent?: string;
  language?: string;
  timezone?: string;
};

export type RequestContext = {
  userId: Id<"users">;
  userEmail?: string;
  userRole: "admin" | "user";
  requestMeta: RequestMeta | null;
};

export type HttpRequestContext = RequestContext & {
  ip: string | null;
  origin: string | null;
};

export function extractIpFromRequest(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export function parseLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return "en";
  return acceptLanguage.split(",")[0]?.split(";")[0]?.trim() ?? "en";
}
