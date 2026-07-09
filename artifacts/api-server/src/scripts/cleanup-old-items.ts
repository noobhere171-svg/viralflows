import "dotenv/config";
import { db } from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { eq, and, sql, asc } from "drizzle-orm";

async function deleteByVideoIds(ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(copyrightClaims).where(sql`${copyrightClaims.videoId} IN ${ids}`);
  await db.delete(scheduledUploads).where(sql`${scheduledUploads.queueItemId} IN ${ids}`);
  await db.delete(videoQueue).where(sql`${videoQueue.id} IN ${ids}`);
}

async function main() {
  console.log("=== Dead Letter & Blocked Cleanup ===\n");

  // 1. Delete dead_letter items older than 7 days (keep max 20 per source)
  console.log("--- Dead Letter Cleanup ---");
  const deadSources = await db.select({
    sourceId: videoQueue.sourceId,
    count: sql<number>`count(*)::int`,
  })
    .from(videoQueue)
    .where(eq(videoQueue.status, "dead_letter"))
    .groupBy(videoQueue.sourceId);

  let totalDead = 0;
  for (const src of deadSources) {
    if (!src.sourceId || src.count <= 20) continue;
    const excess = src.count - 20;
    console.log(`Source ${src.sourceId}: ${src.count} dead_letter, removing ${excess}...`);

    const items = await db.select({ id: videoQueue.id })
      .from(videoQueue)
      .where(eq(videoQueue.sourceId, src.sourceId))
      .orderBy(asc(videoQueue.createdAt))
      .limit(excess);

    if (items.length > 0) {
      await deleteByVideoIds(items.map(i => i.id));
      totalDead += items.length;
      console.log(`  Deleted ${items.length} dead_letter items`);
    }
  }

  // 2. Delete blocked items (keep max 10 per source)
  console.log("\n--- Blocked Cleanup ---");
  const blockedSources = await db.select({
    sourceId: videoQueue.sourceId,
    count: sql<number>`count(*)::int`,
  })
    .from(videoQueue)
    .where(eq(videoQueue.status, "blocked"))
    .groupBy(videoQueue.sourceId);

  let totalBlocked = 0;
  for (const src of blockedSources) {
    if (!src.sourceId || src.count <= 10) continue;
    const excess = src.count - 10;
    console.log(`Source ${src.sourceId}: ${src.count} blocked, removing ${excess}...`);

    const items = await db.select({ id: videoQueue.id })
      .from(videoQueue)
      .where(eq(videoQueue.sourceId, src.sourceId))
      .orderBy(asc(videoQueue.createdAt))
      .limit(excess);

    if (items.length > 0) {
      await deleteByVideoIds(items.map(i => i.id));
      totalBlocked += items.length;
      console.log(`  Deleted ${items.length} blocked items`);
    }
  }

  // 3. Delete cancelled items (keep max 20 per source)
  console.log("\n--- Cancelled Cleanup ---");
  const cancelledSources = await db.select({
    sourceId: videoQueue.sourceId,
    count: sql<number>`count(*)::int`,
  })
    .from(videoQueue)
    .where(eq(videoQueue.status, "cancelled"))
    .groupBy(videoQueue.sourceId);

  let totalCancelled = 0;
  for (const src of cancelledSources) {
    if (!src.sourceId || src.count <= 20) continue;
    const excess = src.count - 20;
    console.log(`Source ${src.sourceId}: ${src.count} cancelled, removing ${excess}...`);

    const items = await db.select({ id: videoQueue.id })
      .from(videoQueue)
      .where(eq(videoQueue.sourceId, src.sourceId))
      .orderBy(asc(videoQueue.createdAt))
      .limit(excess);

    if (items.length > 0) {
      await deleteByVideoIds(items.map(i => i.id));
      totalCancelled += items.length;
      console.log(`  Deleted ${items.length} cancelled items`);
    }
  }

  // 4. Summary
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(videoQueue);
  const [pending] = await db.select({ count: sql<number>`count(*)::int` }).from(videoQueue).where(eq(videoQueue.status, "pending"));

  console.log(`\n=== Summary ===`);
  console.log(`Dead letter deleted: ${totalDead}`);
  console.log(`Blocked deleted: ${totalBlocked}`);
  console.log(`Cancelled deleted: ${totalCancelled}`);
  console.log(`Total queue items: ${total?.count ?? 0}`);
  console.log(`Total pending: ${pending?.count ?? 0}`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
