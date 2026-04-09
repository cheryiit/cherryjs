// @ts-nocheck — Convex issue #53: TS2589 (type instantiation excessively
// deep) on `makeMigration` after schema growth. Runtime is fine.
import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "../_generated/server";

export const migration = makeMigration(internalMutation, {
  migrationTable: "migrations",
});

export {
  startMigration,
  startMigrationsSerially,
  cancelMigration,
  getStatus as getMigrationStatus,
} from "convex-helpers/server/migrations";
