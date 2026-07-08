import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).unique().notNull(),
  uploadComplete: boolean("upload_complete").default(true),
  uploadFailed: boolean("upload_failed").default(true),
  authExpiring: boolean("auth_expiring").default(true),
  quotaWarning: boolean("quota_warning").default(true),
  newSource: boolean("new_source").default(true),
  weeklyReport: boolean("weekly_report").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
