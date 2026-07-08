import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const operations = pgTable("operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  jobType: text("job_type").notNull(),
  status: text("status").default("queued"),
  progress: integer("progress").default(0),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  logs: jsonb("logs"),
  createdAt: timestamp("created_at").defaultNow(),
});
