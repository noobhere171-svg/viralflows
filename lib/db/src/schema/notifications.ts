import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  relatedEntity: text("related_entity"),
  createdAt: timestamp("created_at").defaultNow(),
});
