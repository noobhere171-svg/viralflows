import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";
import { videoQueue } from "./video-queue.js";

export const copyrightClaims = pgTable("copyright_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id),
  videoId: uuid("video_id").references(() => videoQueue.id),
  claimType: text("claim_type"),
  restrictionCountries: text("restriction_countries"),
  status: text("status").default("active"),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
