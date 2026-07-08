import { pgTable, uuid, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { channels } from "./channels.js";

export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  channelId: uuid("channel_id").references(() => channels.id),
  date: timestamp("date").notNull(),
  views: integer("views").default(0),
  subscribersGained: integer("subscribers_gained").default(0),
  videosPosted: integer("videos_posted").default(0),
  avgWatchTime: numeric("avg_watch_time"),
  revenue: numeric("revenue"),
  createdAt: timestamp("created_at").defaultNow(),
});
