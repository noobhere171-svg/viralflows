import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id").notNull(),
  memberUserId: uuid("member_user_id").references(() => users.id).notNull(),
  role: text("role").default("editor"),
  branding: jsonb("branding"),
});
