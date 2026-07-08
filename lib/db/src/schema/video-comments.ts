import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";
import { videoQueue } from "./video-queue.js";

export const videoComments = pgTable("video_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id),
  videoId: uuid("video_id").references(() => videoQueue.id),
  youtubeCommentId: text("youtube_comment_id").unique(),
  authorName: text("author_name"),
  commentText: text("comment_text"),
  publishedAt: timestamp("published_at"),
  likeCount: integer("like_count").default(0),
  isRead: boolean("is_read").default(false),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
