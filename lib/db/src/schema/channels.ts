import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { gcpCredentials } from "./gcp-credentials.js";

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  youtubeChannelId: text("youtube_channel_id"),
  channelName: text("channel_name").notNull(),
  channelHandle: text("channel_handle"),
  thumbnailUrl: text("thumbnail_url"),
  sourceId: uuid("source_id"),
  gcpCredentialId: uuid("gcp_credential_id").references(() => gcpCredentials.id),
  authStatus: text("auth_status").default("pending"),
  videosUploaded: integer("videos_uploaded").default(0),
  quotaUsed: integer("quota_used").default(0),
  isActive: boolean("is_active").default(true),
  totalViews: integer("total_views").default(0),
  totalLikes: integer("total_likes").default(0),
  totalComments: integer("total_comments").default(0),
  totalSubsGained: integer("total_subs_gained").default(0),
  totalCopyrightIssues: integer("total_copyright_issues").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
