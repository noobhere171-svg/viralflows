import { db } from "./src/index.js";
import { sql } from "drizzle-orm";
import { getErrorMessage } from "../errors.js";

const KEEPALIVE_INTERVAL_MS = Number(process.env.DB_KEEPALIVE_INTERVAL_MS ?? 4 * 60 * 1000);

export function startDbKeepalive() {
  setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch (err) {
      console.error(`[DB Keepalive] ping failed: ${getErrorMessage(err)}`);
    }
  }, KEEPALIVE_INTERVAL_MS);

  console.log(`[DB Keepalive] started, pinging every ${KEEPALIVE_INTERVAL_MS / 1000}s`);
}
