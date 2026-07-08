import { pgTable, uuid, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";

export const analyticsDaily = pgTable("analytics_daily", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id),
  date: date("date").notNull(),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  subsGained: integer("subs_gained").default(0),
  watchTimeMinutes: numeric("watch_time_minutes", { precision: 10, scale: 2 }).default("0"),
  estimatedRevenue: numeric("estimated_revenue", { precision: 10, scale: 2 }).default("0"),
  videosPosted: integer("videos_posted").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
