import "dotenv/config";
import { db } from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { eq, and, sql, isNotNull, asc } from "drizzle-orm";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";

async function deleteByVideoIds(ids: string[]) {
  if (ids.length === 0) return;
  // Delete all FK-referencing rows first
  await db.delete(copyrightClaims).where(sql`${copyrightClaims.videoId} IN ${ids}`);
  await db.delete(scheduledUploads).where(sql`${scheduledUploads.queueItemId} IN ${ids}`);
  // Now delete video_queue rows
  await db.delete(videoQueue).where(sql`${videoQueue.id} IN ${ids}`);
}

async function main() {
  console.log("=== Cleanup Excess Queue Items ===\n");

  // 1. Find all sources with more than 5 pending items
  const excessSources = await db.select({
    sourceId: videoQueue.sourceId,
    count: sql<number>`count(*)::int`,
  })
    .from(videoQueue)
    .where(and(eq(videoQueue.status, "pending"), isNotNull(videoQueue.sourceId)))
    .groupBy(videoQueue.sourceId)
    .having(sql`count(*) > 5`);

  let totalDeleted = 0;

  for (const src of excessSources) {
    if (!src.sourceId) continue;
    const excess = src.count - 5;
    console.log(`Source ${src.sourceId}: ${src.count} pending, removing ${excess} excess...`);

    // Keep newest 5, delete oldest excess
    const excessItems = await db.select({ id: videoQueue.id })
      .from(videoQueue)
      .where(and(eq(videoQueue.sourceId, src.sourceId), eq(videoQueue.status, "pending")))
      .orderBy(asc(videoQueue.createdAt))
      .limit(excess);

    if (excessItems.length > 0) {
      const ids = excessItems.map((r: any) => r.id);
      await deleteByVideoIds(ids);
      console.log(`  Deleted ${ids.length} items`);
      totalDeleted += ids.length;
    }
  }

  // 2. Cancel duplicate pending items (same source_video_id + target_channel_id)
  console.log("\n=== Cancelling duplicate pending items ===");
  const dupes = await db.select({
    sourceVideoId: videoQueue.sourceVideoId,
    targetChannelId: videoQueue.targetChannelId,
    count: sql<number>`count(*)::int`,
  })
    .from(videoQueue)
    .where(and(
      eq(videoQueue.status, "pending"),
      isNotNull(videoQueue.sourceVideoId),
      isNotNull(videoQueue.targetChannelId)
    ))
    .groupBy(videoQueue.sourceVideoId, videoQueue.targetChannelId)
    .having(sql`count(*) > 1`);

  for (const dupe of dupes) {
    if (!dupe.sourceVideoId || !dupe.targetChannelId) continue;
    console.log(`  Duplicate: sourceVideo=${dupe.sourceVideoId} channel=${dupe.targetChannelId} (${dupe.count}x)`);

    const allRows = await db.select({ id: videoQueue.id, createdAt: videoQueue.createdAt })
      .from(videoQueue)
      .where(and(
        eq(videoQueue.status, "pending"),
        eq(videoQueue.sourceVideoId, dupe.sourceVideoId),
        eq(videoQueue.targetChannelId, dupe.targetChannelId)
      ))
      .orderBy(asc(videoQueue.createdAt));

    // Keep oldest, cancel rest
    const toCancel = allRows.slice(1);
    for (const row of toCancel) {
      await db.update(videoQueue)
        .set({ status: "cancelled", errorMessage: "Duplicate of earlier pending item" })
        .where(eq(videoQueue.id, row.id));
      console.log(`    Cancelled ${row.id}`);
      totalDeleted++;
    }
  }

  // 3. Summary
  const [remaining] = await db.select({ count: sql<number>`count(*)::int` })
    .from(videoQueue)
    .where(eq(videoQueue.status, "pending"));

  console.log(`\n=== Done ===`);
  console.log(`Removed/cancelled: ${totalDeleted} items`);
  console.log(`Remaining pending: ${remaining?.count ?? 0}`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
