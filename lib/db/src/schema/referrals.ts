import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerUserId: uuid("referrer_user_id").references(() => users.id).notNull(),
  referredUserId: uuid("referred_user_id").references(() => users.id),
  status: text("status").default("pending"),
  rewardAmount: numeric("reward_amount"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
