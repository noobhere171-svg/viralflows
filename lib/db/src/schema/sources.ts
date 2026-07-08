import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { proxies } from "./proxies.js";

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(),
  accountHandle: text("account_handle"),
  accountUrl: text("account_url"),
  linkedChannelId: uuid("linked_channel_id"),
  proxyId: uuid("proxy_id").references(() => proxies.id),
  fetchFrequencyHours: integer("fetch_frequency_hours").default(6),
  contentFilter: jsonb("content_filter"),
  lastSyncedAt: timestamp("last_synced_at"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});
