import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";

const triggers = new Triggers<DataModel>();

// Register table-specific triggers here as the project grows.
// Example:
// triggers.register("trades", async (ctx, change) => {
//   await tradeCountAggregate.trigger(ctx, change);
// });

export default triggers;
