import { pgTable, uuid, text, jsonb, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const featureDefinitions = pgTable("feature_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(),
  label: text("label").notNull(),
  type: text("type").default("number"),
  defaultVal: jsonb("default_val").default(0),
  sortOrder: integer("sort_order").default(0),
  isEnforced: boolean("is_enforced").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
