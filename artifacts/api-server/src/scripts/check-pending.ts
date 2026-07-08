import "dotenv/config";
import { db } from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(videoQueue).where(eq(videoQueue.status, "pending"));
  const bySource = await db.select({ sourceId: videoQueue.sourceId, count: sql<number>`count(*)::int` })
    .from(videoQueue).where(eq(videoQueue.status, "pending")).groupBy(videoQueue.sourceId);
  console.log("Total pending:", total?.count);
  console.log("By source:");
  for (const r of bySource) {
    console.log("  ", r.sourceId, ":", r.count);
  }
}
main().catch(console.error);
