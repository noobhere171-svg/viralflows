import "dotenv/config";
import app from "./app.js";

process.on("unhandledRejection", (err: any) => {
  console.error(`[UnhandledRejection] ${err?.message || err}`);
});

const PORT = process.env.PORT || 5000;

console.log("[ViralFlows API] Starting...");
console.log(`[ViralFlows API] Port: ${PORT}`);
console.log(`[ViralFlows API] DB: ${process.env.DATABASE_URL ? "Configured" : "MISSING"}`);
console.log(`[ViralFlows API] S3 Storage: ${process.env.S3_ACCESS_KEY ? "Configured (IDrive e2)" : "MISSING"}`);
console.log(`[ViralFlows API] LLM: Groq=${process.env.GROQ_API_KEYS ? "OK" : "MISSING"} OpenRouter=${process.env.OPENROUTER_API_KEYS ? "OK" : "MISSING"}`);
console.log(`[ViralFlows API] Clerk: ${process.env.CLERK_SECRET_KEY ? "Configured" : "MISSING"}`);
console.log(`[ViralFlows API] Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
console.log(`[ViralFlows API] Backend URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
console.log(`[ViralFlows API] OAuth Callback: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api/workspaces/oauth/callback`);

app.listen(PORT, () => {
  console.log(`[ViralFlows API] Running on http://localhost:${PORT}`);
});

import { startDbKeepalive } from "../../../lib/db/keepalive.js";
import db from "../../../lib/db/src/index.js";
import { sql } from "drizzle-orm";

// Warm up Neon compute on startup so first request doesn't timeout
(async () => {
  try {
    await db.execute(sql`SELECT 1`);
    console.log("[DB] Warmup ping successful");
  } catch (err: any) {
    console.error(`[DB] Warmup ping failed: ${err?.message || err}`);
  }
})();

// Migration 0005: UNIQUE index on video_queue(source_id, source_video_id)
(async () => {
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vq_source_video_unique
        ON video_queue(source_id, source_video_id)
        WHERE source_video_id IS NOT NULL
    `);
    console.log("[DB] Migration 0005: queue unique index applied");
  } catch (err: any) {
    console.error(`[DB] Migration 0005 failed: ${err?.message || err}`);
  }
})();

// Migration 0006: Add country + operation flags to global_proxies
(async () => {
  try {
    await db.execute(sql`
      ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS country text;
      ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_fetch boolean DEFAULT true;
      ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_download boolean DEFAULT true;
      ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_upload boolean DEFAULT false;
    `);
    console.log("[DB] Migration 0006: global_proxies columns added");
  } catch (err: any) {
    console.error(`[DB] Migration 0006 failed: ${err?.message || err}`);
  }
})();

startDbKeepalive();

import { startScheduler } from "./workers/scheduler.js";
startScheduler();
console.log("[ViralFlows API] Scheduler started (polls every 60s)");

import { startAnalyticsSync } from "./workers/analytics-sync.js";
startAnalyticsSync();
console.log("[ViralFlows API] Analytics sync started (polls every 6 hours)");
