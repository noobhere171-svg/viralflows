import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  category: text("category"),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  status: text("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});
