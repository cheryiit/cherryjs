import { defineSchema } from "convex/server";
import { coreTables } from "./core/core.schema";
import { usersTables } from "./apps/users/users.schema";
import { paymentsTables } from "./apps/payments/payments.schema";
import { waitlistTables } from "./apps/waitlist/waitlist.schema";
import { notificationsTables } from "./apps/notifications/notifications.schema";

export default defineSchema({
  ...coreTables,
  ...usersTables,
  ...paymentsTables,
  ...waitlistTables,
  ...notificationsTables,
});
