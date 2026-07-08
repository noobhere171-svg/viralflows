import "dotenv/config";
import { db } from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("=== ALL STATUS BY SOURCE ===");
  const all = await db.select({
    sourceId: videoQueue.sourceId,
    status: videoQueue.status,
    count: sql<number>`count(*)::int`,
  }).from(videoQueue).groupBy(videoQueue.sourceId, videoQueue.status).orderBy(videoQueue.sourceId);
  console.table(all);

  console.log("\n=== PENDING PER SOURCE ===");
  const pending = await db.select({
    sourceId: videoQueue.sourceId,
    count: sql<number>`count(*)::int`,
  }).from(videoQueue).where(eq(videoQueue.status, "pending")).groupBy(videoQueue.sourceId).orderBy(videoQueue.sourceId);
  console.table(pending);

  console.log("\n=== RULE CHECK: Each source should have exactly 5 pending ===");
  for (const r of pending) {
    const status = r.count === 5 ? "OK" : r.count < 5 ? "LOW" : "OVER";
    console.log(`  ${r.sourceId}: ${r.count} pending [${status}]`);
  }
}
main().catch(console.error);
