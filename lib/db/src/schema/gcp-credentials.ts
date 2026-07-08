import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const gcpCredentials = pgTable("gcp_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  clientEmail: text("client_email"),
  oauthFilePath: text("oauth_file_path"),
  channelCount: integer("channel_count").default(0),
  status: text("status").default("active"),
  dailyUploadCount: integer("daily_upload_count").default(0),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
  blockedAt: timestamp("blocked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
