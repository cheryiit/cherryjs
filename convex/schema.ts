import { defineSchema } from "convex/server";
import { coreTables } from "./core/coreSchema";
import { usersTables } from "./apps/users/usersSchema";
import { paymentsTables } from "./apps/payments/paymentsSchema";
import { waitlistTables } from "./apps/waitlist/waitlistSchema";
import { notificationsTables } from "./apps/notifications/notificationsSchema";
import { inAppNotificationsTables } from "./apps/inAppNotifications/inAppNotificationsSchema";

export default defineSchema({
  ...coreTables,
  ...usersTables,
  ...paymentsTables,
  ...waitlistTables,
  ...notificationsTables,
  ...inAppNotificationsTables,
});
