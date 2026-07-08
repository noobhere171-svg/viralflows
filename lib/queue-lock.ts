import { sql, eq, and, lt, isNotNull } from "drizzle-orm";
import type { db as DbType } from "./db/src/index.js";

const LEASE_TTL_MINUTES = Number(process.env.PROCESSING_LEASE_TTL_MINUTES ?? 15);

export interface ClaimResult {
  claimed: boolean;
  reason?: "not_pending" | "race_lost";
}

export async function claimQueueItem(
  db: typeof DbType,
  videoQueueTable: any,
  queueItemId: string
): Promise<ClaimResult> {
  const result = await db
    .update(videoQueueTable)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
    })
    .where(and(eq(videoQueueTable.id, queueItemId), eq(videoQueueTable.status, "pending")))
    .returning({ id: videoQueueTable.id });

  if (result.length === 0) {
    return { claimed: false, reason: "race_lost" };
  }
  return { claimed: true };
}

export async function checkAndReclaimChannelLease(
  db: typeof DbType,
  videoQueueTable: any,
  channelId: string
): Promise<{ blocked: boolean; reclaimedItemId?: string }> {
  const staleThreshold = new Date(Date.now() - LEASE_TTL_MINUTES * 60 * 1000);

  const processingRows = await db
    .select({ id: videoQueueTable.id, processingStartedAt: videoQueueTable.processingStartedAt })
    .from(videoQueueTable)
    .where(and(eq(videoQueueTable.targetChannelId, channelId), eq(videoQueueTable.status, "processing")));

  if (processingRows.length === 0) {
    return { blocked: false };
  }

  const row = processingRows[0];
  const startedAt = row.processingStartedAt ? new Date(row.processingStartedAt as any) : null;

  const isStale = !startedAt || startedAt < staleThreshold;

  if (!isStale) {
    return { blocked: true };
  }

  await db
    .update(videoQueueTable)
    .set({
      status: "failed",
      errorMessage: `Lease expired after ${LEASE_TTL_MINUTES}min (crashed worker).`,
    })
    .where(eq(videoQueueTable.id, row.id));

  return { blocked: false, reclaimedItemId: row.id as string };
}

export async function sweepStaleLeasesOnStartup(db: typeof DbType, videoQueueTable: any) {
  const staleThreshold = new Date(Date.now() - LEASE_TTL_MINUTES * 60 * 1000);

  const reclaimed = await db
    .update(videoQueueTable)
    .set({
      status: "failed",
      errorMessage: `Lease expired after ${LEASE_TTL_MINUTES}min (startup sweep).`,
    })
    .where(
      and(
        eq(videoQueueTable.status, "processing"),
        sql`(${videoQueueTable.processingStartedAt} IS NULL OR ${videoQueueTable.processingStartedAt} < ${staleThreshold.toISOString()}::timestamptz)`
      )
    )
    .returning({ id: videoQueueTable.id });

  return reclaimed.length;
}
