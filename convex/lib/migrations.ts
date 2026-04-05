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
