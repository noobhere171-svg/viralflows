import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  ssl: "require",
  connect_timeout: 60,
  max: 15,
  max_lifetime: 60 * 5,
  idle_timeout: 60,
  keep_alive: 30,
  onnotice: () => {},
  onparameter: () => {},
});

export const db = drizzle(client, { schema });
export default db;
