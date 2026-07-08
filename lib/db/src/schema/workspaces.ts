import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").default("My Workspace"),
  email: text("email").notNull(),
  gcpProjectId: text("gcp_project_id"),
  gcpEmail: text("gcp_email"),
  oauthFilePath: text("oauth_file_path"),
  youtubeOAuthTokenId: text("youtube_oauth_token_id"),
  authStatus: text("auth_status").default("pending"),
  authExpiresAt: timestamp("auth_expires_at"),
  quotaUsedToday: integer("quota_used_today").default(0),
  quotaResetAt: timestamp("quota_reset_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
