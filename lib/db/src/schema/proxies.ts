import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const proxies = pgTable("proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull(),
  protocol: text("protocol").default("http"),
  username: text("username"),
  passwordEncrypted: text("password_encrypted"),
  status: text("status").default("active"),
  speedMs: integer("speed_ms"),
  successRate: integer("success_rate"),
  assignedSourceId: uuid("assigned_source_id"),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
