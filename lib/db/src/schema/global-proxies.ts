import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const globalProxies = pgTable("global_proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull(),
  protocol: text("protocol").default("http"),
  username: text("username"),
  passwordEncrypted: text("password_encrypted"),
  status: text("status").default("active"),
  speedMs: integer("speed_ms"),
  assignedToPlan: text("assigned_to_plan").default("all"),
  maxConcurrentUsers: integer("max_concurrent_users").default(5),
  currentUsers: integer("current_users").default(0),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
