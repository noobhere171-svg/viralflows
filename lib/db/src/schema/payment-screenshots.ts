import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const paymentScreenshots = pgTable("payment_screenshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  requestedPlan: text("requested_plan").notNull(),
  paymentMethod: text("payment_method").notNull(),
  screenshotUrl: text("screenshot_url"),
  amount: integer("amount").default(0),
  transactionId: text("transaction_id"),
  status: text("status").default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
