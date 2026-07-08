import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { channels } from "./channels.js";
import { videoQueue } from "./video-queue.js";

export const scheduledUploads = pgTable("scheduled_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  queueItemId: uuid("queue_item_id").references(() => videoQueue.id),
  channelId: uuid("channel_id").references(() => channels.id),
  scheduledAt: timestamp("scheduled_at"),
  cronExpression: text("cron_expression").default("0 */6 * * *"),
  timezone: text("timezone").default("America/New_York"),
  maxVideosPerDay: text("max_videos_per_day").default("3"),
  uploadTimes: text("upload_times").default("[]"),
  activeDays: text("active_days").default("[]"),
  active: boolean("active").default(true),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  lastClaimedAt: timestamp("last_claimed_at"),
  status: text("status").default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
});
