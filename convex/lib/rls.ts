import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type UserCtx = { user: Doc<"users"> };

type RlsRules = {
  [K in keyof DataModel]?: {
    read?: (ctx: UserCtx, doc: any) => Promise<boolean>;
    modify?: (ctx: UserCtx, doc: any) => Promise<boolean>;
    insert?: (ctx: UserCtx, value: any) => Promise<boolean>;
  };
};

export const rlsRules: RlsRules = {
  // Users can only read/modify their own profile
  users: {
    read: async (ctx, doc) => {
      return doc._id === ctx.user._id || ctx.user.role === "admin";
    },
    modify: async (ctx, doc) => {
      return doc._id === ctx.user._id || ctx.user.role === "admin";
    },
  },

  // Audit logs: admin only
  auditLogs: {
    read: async (ctx) => ctx.user.role === "admin",
    modify: async () => false,
  },
};

export function withRls(ctx: QueryCtx & UserCtx) {
  return {
    ...ctx,
    db: wrapDatabaseReader(ctx, ctx.db, rlsRules as any),
  };
}

export function withRlsWrite(ctx: MutationCtx & UserCtx) {
  return {
    ...ctx,
    db: wrapDatabaseWriter(ctx, ctx.db, rlsRules as any),
  };
}
