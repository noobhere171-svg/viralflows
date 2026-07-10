import db from "../../../../lib/db/src/index.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { proxies } from "../../../../lib/db/src/schema/proxies.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { operations } from "../../../../lib/db/src/schema/operations.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { videoComments } from "../../../../lib/db/src/schema/video-comments.js";
import { gcpCredentials } from "../../../../lib/db/src/schema/gcp-credentials.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq, and, lt, isNotNull, sql, inArray } from "drizzle-orm";
import { fetchTikTokVideo, fetchTikTokUserVideos, fetchTikTokUserVideosViaYtDlp, fetchTikTokVideoViaYtDlp, isTikTokUsername } from "../lib/tiktok.js";
import { hasWorkspaceCookies, getWorkspaceCookiesPath } from "../lib/filebase.js";

import { checkAndReclaimChannelLease, sweepStaleLeasesOnStartup } from "../../../../lib/queue-lock.js";
import { isRealTikError } from "../../../../lib/rate-limiter.js";
import { getErrorMessage } from "../../../../lib/errors.js";
import { sendAlert } from "../../../../lib/alerts.js";
import { createNotification } from "../../../../lib/notifications.js";
import { runUploadPipeline } from "../../../../lib/upload-pipeline.js";
import { checkQueueSizeLimit } from "../../../../lib/plan-limits.js";

const POLL_INTERVAL_MS = 60_000;
const UPLOAD_TIME_WINDOW_MIN = Number(process.env.UPLOAD_TIME_WINDOW_MIN ?? 5);
const AUTH_FAILED_LOG_INTERVAL_MS = 60 * 60 * 1000;

const lastAuthFailedLog: Record<string, number> = {};
const refillThrottle: Record<string, number> = {};
const REFILL_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

const uploadQueue: { schedule: any; channel: any }[] = [];
let processingQueue = false;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function safeJson(val: string | undefined | null): any {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

async function resolveCookiesPath(workspaceId?: string | null): Promise<string | undefined> {
  if (!workspaceId) return undefined;
  const exists = await hasWorkspaceCookies(workspaceId);
  return exists ? getWorkspaceCookiesPath(workspaceId) : undefined;
}

async function resolveProxyUrl(proxyId?: string | null): Promise<string | undefined> {
  if (!proxyId) return undefined;
  const [proxy] = await db.select().from(proxies).where(eq(proxies.id, proxyId));
  if (!proxy) return undefined;
  const auth = proxy.username ? `${proxy.username}:${proxy.passwordEncrypted || ""}@` : "";
  return `${proxy.protocol}://${auth}${proxy.ipAddress}:${proxy.port}`;
}

const GCP_DAILY_LIMIT = Number(process.env.GCP_DAILY_LIMIT ?? 4);

/**
 * Dynamic per-channel daily limit based on how many channels share the same GCP.
 * Rule: 1 channel/GCP = 3/day, 2 channels/GCP = 2/day, 3 channels/GCP = 1/day
 */
async function getMaxVideosPerDayForChannel(channelId: string): Promise<number> {
  const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!ch?.gcpCredentialId) return 3;

  const [row] = await db.select({ cnt: sql<number>`count(*)::int` })
    .from(channels)
    .where(eq(channels.gcpCredentialId, ch.gcpCredentialId));
  const count = row?.cnt ?? 1;

  if (count <= 1) return 3;
  if (count === 2) return 2;
  return 1;
}

async function getTodayUploadCountByChannel(channelId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(videoQueue)
    .where(and(
      eq(videoQueue.targetChannelId, channelId),
      eq(videoQueue.status, "uploaded"),
      sql`date_trunc('day', ${videoQueue.uploadedAt}) = date_trunc('day', NOW())`
    ));
  return row?.count ?? 0;
}

async function getTodayUploadCountByGcp(credentialId: string): Promise<number> {
  const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, credentialId));
  if (!cred) return 0;
  if (cred.lastResetAt) {
    const lastReset = new Date(cred.lastResetAt);
    const now = new Date();
    if (lastReset.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
      return cred.dailyUploadCount ?? 0;
    }
  }
  await db.update(gcpCredentials).set({ dailyUploadCount: 0, lastResetAt: new Date() }).where(eq(gcpCredentials.id, credentialId));
  return 0;
}

async function incrementGcpDailyCount(credentialId: string) {
  await db.update(gcpCredentials)
    .set({ dailyUploadCount: sql`COALESCE(${gcpCredentials.dailyUploadCount}, 0) + 1` })
    .where(eq(gcpCredentials.id, credentialId));
}

async function markGcpBlocked(credentialId: string) {
  await db.update(gcpCredentials)
    .set({ status: "blocked", blockedAt: new Date() })
    .where(eq(gcpCredentials.id, credentialId));
  console.warn(`[Scheduler] GCP credential ${credentialId} marked as BLOCKED`);
}

async function expireGcpAndDeauthChannels(credentialId: string) {
  const affectedChannels = await db.select().from(channels)
    .where(eq(channels.gcpCredentialId, credentialId));

  for (const ch of affectedChannels) {
    await db.update(channels).set({
      authStatus: "expired",
      youtubeChannelId: null,
      channelHandle: null,
    }).where(eq(channels.id, ch.id));
    console.warn(`[Scheduler] Channel ${ch.channelName} de-authorized (GCP blocked)`);
  }

  await db.update(gcpCredentials)
    .set({ status: "expired", channelCount: 0 })
    .where(eq(gcpCredentials.id, credentialId));

  console.warn(`[Scheduler] GCP ${credentialId} expired, ${affectedChannels.length} channels de-authorized`);
}

function getTimeInTimezone(date: Date, tz: string): { h: number; m: number; y: number; mo: number; d: number } {
  if (!tz || tz === "UTC") {
    return { h: date.getUTCHours(), m: date.getUTCMinutes(), y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate() };
  }
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts = f.formatToParts(date);
  const p = (type: string) => parseInt(parts.find((x) => x.type === type)!.value, 10);
  return { h: p("hour"), m: p("minute"), y: p("year"), mo: p("month"), d: p("day") };
}

function isTimeToUpload(uploadTimes: string[], timezone?: string): boolean {
  if (uploadTimes.length === 0) return false;
  const now = new Date();
  const t = getTimeInTimezone(now, timezone || "UTC");
  const currentMin = t.h * 60 + t.m;
  for (const time of uploadTimes) {
    const [h, m] = time.split(":").map(Number);
    const targetMin = h * 60 + m;
    if (Math.abs(currentMin - targetMin) <= UPLOAD_TIME_WINDOW_MIN) return true;
  }
  return false;
}

function isSameDayInTimezone(d1: Date, d2: Date, tz: string): boolean {
  const a = getTimeInTimezone(d1, tz);
  const b = getTimeInTimezone(d2, tz);
  return a.y === b.y && a.mo === b.mo && a.d === b.d;
}

function hasUploadedAtCurrentSlot(schedule: any, tz: string): boolean {
  if (!schedule.lastRunAt) return false;
  const now = new Date();
  const lastRun = new Date(schedule.lastRunAt);
  if (!isSameDayInTimezone(lastRun, now, tz)) return false;
  const nowTz = getTimeInTimezone(now, tz);
  const lastTz = getTimeInTimezone(lastRun, tz);
  return Math.abs((nowTz.h * 60 + nowTz.m) - (lastTz.h * 60 + lastTz.m)) <= 5;
}

export function startScheduler() {
  console.log("[Scheduler] Starting background scheduler (poll every 60s)");

  sweepStaleLeasesOnStartup(db, videoQueue).then((count) => {
    if (count > 0) console.log(`[Scheduler] Startup: reclaimed ${count} stale processing lease(s)`);
  }).catch(err => console.error(`[Scheduler] Startup sweep error: ${getErrorMessage(err)}`));

  runCycle().catch(err => console.error(`[Scheduler] Initial cycle error: ${getErrorMessage(err)}`));
  setInterval(() => runCycle().catch(err => console.error(`[Scheduler] Cycle error: ${getErrorMessage(err)}`)), POLL_INTERVAL_MS);

  catchUpMissedUploads().catch(err => console.error(`[Scheduler] Catch-up error: ${getErrorMessage(err)}`));
}

async function catchUpMissedUploads() {
  try {
    const allActive = await db.select().from(scheduledUploads).where(eq(scheduledUploads.active, true));
    const now = new Date();
    let catchUpCount = 0;

    for (const schedule of allActive) {
      if (!schedule.channelId) continue;
      const times = safeJson(schedule.uploadTimes) as string[];
      const tz = schedule.timezone || "UTC";
      if (times.length === 0) continue;

      const lastRun = schedule.lastRunAt ? new Date(schedule.lastRunAt) : null;

      for (const time of times) {
        const [h, m] = time.split(":").map(Number);
        const slotToday = new Date(now);
        slotToday.setUTCHours(h, m, 0, 0);

        if (now < slotToday) continue;

        if (lastRun && lastRun > slotToday) continue;

        if (lastRun && lastRun.getTime() > slotToday.getTime() - UPLOAD_TIME_WINDOW_MIN * 60 * 1000
          && lastRun.getTime() < slotToday.getTime() + UPLOAD_TIME_WINDOW_MIN * 60 * 1000) continue;

        const slotAge = now.getTime() - slotToday.getTime();
        if (slotAge > 12 * 60 * 60 * 1000) continue;

        const [channel] = await db.select().from(channels).where(eq(channels.id, schedule.channelId));
        if (!channel || channel.authStatus !== "authorized") continue;

        const pending = await db.select({ id: videoQueue.id }).from(videoQueue)
          .where(and(eq(videoQueue.targetChannelId, schedule.channelId), eq(videoQueue.status, "pending")));
        if (pending.length === 0) continue;

        console.log(`[Scheduler] Catch-up: missed upload slot ${time} for ${channel.channelName} (${slotAge / 60000}min ago) — processing now`);
        uploadQueue.push({ schedule, channel });
        catchUpCount++;
      }
    }

    if (catchUpCount > 0) {
      console.log(`[Scheduler] Catch-up: ${catchUpCount} missed slot(s) queued for processing`);
      if (!processingQueue) processUploadQueue();
    }
  } catch (err) {
    console.error(`[Scheduler] Catch-up error: ${getErrorMessage(err)}`);
  }
}

async function checkExpiredPlans() {
  const now = new Date();
  const expired = await db.select().from(users).where(
    and(isNotNull(users.planExpiresAt), lt(users.planExpiresAt, now), sql`${users.plan} != 'free'`)
  );
  for (const user of expired) {
    await db.update(users).set({ plan: "free", videosLimit: 3, planExpiresAt: null }).where(eq(users.id, user.id));
    console.log(`[Scheduler] Plan expired for ${user.email} — downgraded to free`);
  }
}

async function runCycle() {
  try {
    await checkExpiredPlans();
  } catch (err) {
    console.error(`[Scheduler] checkExpiredPlans error: ${getErrorMessage(err)}`);
  }

  try {
    await retryFailedItems();
  } catch (err) {
    console.error(`[Scheduler] retryFailedItems error: ${getErrorMessage(err)}`);
  }

  try {
    await processContinuousUploads();
  } catch (err) {
    console.error(`[Scheduler] processContinuousUploads error: ${getErrorMessage(err)}`);
  }

  try {
    await processAutoRefill();
  } catch (err) {
    console.error(`[Scheduler] processAutoRefill error: ${getErrorMessage(err)}`);
  }

  try {
    await cleanupUploadedQueue();
  } catch (err) {
    console.error(`[Scheduler] Queue cleanup error: ${getErrorMessage(err)}`);
  }
}

async function processDueSchedules() {
  const allActive = await db.select().from(scheduledUploads).where(eq(scheduledUploads.active, true));
  if (allActive.length === 0) return;

  const due = allActive.filter((s) => {
    const times = safeJson(s.uploadTimes) as string[];
    const tz = s.timezone || "UTC";
    if (!isTimeToUpload(times, tz)) return false;
    if (hasUploadedAtCurrentSlot(s, tz)) return false;
    return true;
  });

  if (due.length === 0) return;

  let addedCount = 0;
  for (const schedule of due) {
    if (!schedule.channelId) continue;

    const [channel] = await db.select().from(channels).where(eq(channels.id, schedule.channelId));
    if (!channel) continue;

    if (channel.authStatus !== "authorized") {
      if (channel.authStatus === "expired") {
        // GCP blocked/expired — de-authorize channel silently
        console.warn(`[Scheduler] Channel ${channel.channelName}: auth expired (GCP blocked) — skipped`);
      } else {
        const now = Date.now();
        const lastLog = lastAuthFailedLog[schedule.id] || 0;
        if (now - lastLog > AUTH_FAILED_LOG_INTERVAL_MS) {
          lastAuthFailedLog[schedule.id] = now;
          console.warn(`[Scheduler] Schedule ${schedule.id}: channel ${channel.channelName} auth status is ${channel.authStatus} — skipped slot`);
        }
      }
      await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
      continue;
    }

    const maxPerDay = await getMaxVideosPerDayForChannel(channel.id);
    const todayCount = await getTodayUploadCountByChannel(channel.id);
    if (todayCount >= maxPerDay) {
      console.warn(`[Scheduler] Channel ${channel.channelName}: daily limit reached (${todayCount}/${maxPerDay}) — skipped`);
      await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
      continue;
    }

    if (channel.gcpCredentialId) {
      // Check if GCP is blocked/expired
      const [gcpCred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
      if (gcpCred && (gcpCred.status === "blocked" || gcpCred.status === "expired")) {
        console.warn(`[Scheduler] Channel ${channel.channelName}: GCP ${channel.gcpCredentialId} is ${gcpCred.status} — skipped`);
        await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
        continue;
      }

      const gcpTodayCount = await getTodayUploadCountByGcp(channel.gcpCredentialId);
      // Dynamic GCP limit: sum of per-channel limits for channels on this GCP
      const [chCountRow] = await db.select({ cnt: sql<number>`count(*)::int` })
        .from(channels).where(eq(channels.gcpCredentialId, channel.gcpCredentialId));
      const chCount = chCountRow?.cnt ?? 1;
      const gcpMaxPerDay = chCount === 1 ? 3 : chCount === 2 ? 4 : 3;
      if (gcpTodayCount >= gcpMaxPerDay) {
        console.warn(`[Scheduler] GCP ${channel.gcpCredentialId}: daily limit reached (${gcpTodayCount}/${gcpMaxPerDay}, ${chCount} channels) — skipped`);
        await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
        continue;
      }
    }

    if (uploadQueue.some(q => q.schedule.id === schedule.id)) continue;

    uploadQueue.push({ schedule, channel });
    addedCount++;
  }

  if (addedCount > 0) {
    console.log(`[Scheduler] Added ${addedCount} schedule(s) to upload queue (total: ${uploadQueue.length})`);
  }

  if (!processingQueue && uploadQueue.length > 0) {
    processUploadQueue();
  }
}

async function processUploadQueue() {
  try {
    processingQueue = true;
    console.log(`[Scheduler] Upload queue processor started (${uploadQueue.length} items)`);

    while (uploadQueue.length > 0) {
      const item = uploadQueue.shift()!;
      console.log(`[Scheduler] Processing queue item for ${item.channel.channelName} (${uploadQueue.length} remaining)`);

      const [channel] = await db.select().from(channels).where(eq(channels.id, item.channel.id));
      if (!channel || channel.authStatus !== "authorized") {
        const now = Date.now();
        const lastLog = lastAuthFailedLog[item.schedule.id] || 0;
        if (now - lastLog > AUTH_FAILED_LOG_INTERVAL_MS) {
          lastAuthFailedLog[item.schedule.id] = now;
          console.warn(`[Scheduler] Queue item ${item.schedule.id}: auth changed to ${channel?.authStatus} — removed`);
        }
        await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, item.schedule.id));
        continue;
      }

      await processSingleSchedule(item.schedule, channel);

      if (uploadQueue.length > 0) {
        await sleep(4000);
      }
    }
  } finally {
    processingQueue = false;
    console.log(`[Scheduler] Upload queue processed completely`);
  }
}

async function processSingleSchedule(schedule: any, channel: any) {
  if (!schedule.channelId || !channel) return;

  const lease = await checkAndReclaimChannelLease(db, videoQueue, channel.id);
  if (lease.blocked) {
    console.warn(`[Scheduler] Schedule ${schedule.id}: channel ${channel.channelName} already processing`);
    await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
    return;
  }
  if (lease.reclaimedItemId) {
    console.log(`[Scheduler] Reclaimed stale lease on item ${lease.reclaimedItemId} for ${channel.channelName}`);
  }

  const [source] = await db.select().from(sources)
    .where(eq(sources.linkedChannelId, schedule.channelId));
  if (!source) {
    console.warn(`[Scheduler] Schedule ${schedule.id}: no source linked to channel ${channel.channelName}`);
    await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
    return;
  }

  // Auth sync: unauthorized channel → source error; recovered → source active
  if (channel.authStatus !== "authorized") {
    if (source.status !== "error") {
      await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, source.id));
      console.warn(`[Scheduler] Schedule ${schedule.id}: channel ${channel.channelName} auth=${channel.authStatus} — setting source status=error`);
    }
    await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
    return;
  }
  if (source.status === "error") {
    await db.update(sources).set({ status: "active", lastSyncedAt: new Date() }).where(eq(sources.id, source.id));
    console.log(`[Scheduler] Schedule ${schedule.id}: source ${source.accountHandle} recovered from error to active`);
  }

  let queueItem: typeof videoQueue.$inferSelect | undefined = await findOldestPending(channel.id);

  if (queueItem && queueItem.sourceUrl) {
    const hasNumericId = extractTikTokId(queueItem.sourceUrl) !== null;
    const isCdn = queueItem.sourceUrl.includes("tiktokcdn");
    const hasTikTokPage = queueItem.sourceUrl.includes("tiktok.com/@");
    if (!hasNumericId && (!hasTikTokPage || isCdn)) {
      console.warn(`[Scheduler] Schedule ${schedule.id}: queue item ${queueItem.id} has invalid sourceUrl — dead-lettering`);
      await db.update(videoQueue).set({
        status: "dead_letter",
        errorMessage: `Invalid sourceUrl format (${isCdn ? "CDN" : !hasNumericId ? "non-numeric ID" : "unrecognized"}): ${queueItem.sourceUrl.slice(0, 80)}`,
      }).where(eq(videoQueue.id, queueItem.id));
      queueItem = undefined;
    }
  }

  if (!queueItem) {
    if (source.status === "error" || source.status === "empty") {
      console.log(`[Scheduler] Schedule ${schedule.id}: source ${source.accountHandle} status is "${source.status}" — skipping slot`);
      await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
      return;
    }

    // Try to fill pending queue via centralized refill
    const filter = (source.contentFilter as any) || {};
    if (filter.autoRefillEnabled !== false) {
      await refillSourceToLimit(source.id, { maxPerSource: 5, skipThrottle: true });
    }

    queueItem = await findOldestPending(channel.id);

    if (!queueItem) {
      console.log(`[Scheduler] Schedule ${schedule.id}: no pending videos for channel ${channel.channelName} — skipping slot`);
      await db.update(scheduledUploads).set({ lastRunAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));
      return;
    }
  } else if (!queueItem.sourceVideoId && queueItem.sourceUrl) {
    const backfilled = extractTikTokId(queueItem.sourceUrl);
    if (backfilled) {
      await db.update(videoQueue).set({ sourceVideoId: backfilled }).where(eq(videoQueue.id, queueItem.id));
      queueItem = { ...queueItem, sourceVideoId: backfilled };
    }
  }

  // Upload-time duplicate check: skip already-uploaded videos
  while (queueItem && queueItem.sourceVideoId && await wasVideoAlreadyUploaded(channel.id, queueItem.sourceVideoId)) {
    console.log(`[Scheduler] Schedule ${schedule.id}: queue item ${queueItem.id} (video ${queueItem.sourceVideoId}) already uploaded — dead-lettering`);
    await db.update(videoQueue).set({
      status: "dead_letter",
      errorMessage: "Already uploaded (upload-time dedup)",
    }).where(eq(videoQueue.id, queueItem.id));
    queueItem = await findOldestPending(channel.id);
  }

  if (!queueItem) return;

  await db.insert(operations).values({
    userId: schedule.userId,
    jobType: "scheduled_upload",
    status: "processing",
    relatedEntityType: "scheduled_upload",
    relatedEntityId: schedule.id,
  });

  await db.update(scheduledUploads).set({ lastClaimedAt: new Date() }).where(eq(scheduledUploads.id, schedule.id));

  const result = await runUploadPipeline({ queueItem, channel, context: "scheduler" });

  if (result.success) {
    await db.update(scheduledUploads).set({
      lastRunAt: new Date(),
      queueItemId: queueItem.id,
      status: "scheduled",
    }).where(eq(scheduledUploads.id, schedule.id));

    await db.insert(operations).values({
      userId: schedule.userId,
      jobType: "scheduled_upload",
      status: "completed",
      relatedEntityType: "scheduled_upload",
      relatedEntityId: schedule.id,
    });

    console.log(`[Scheduler] Uploaded item ${queueItem.id} for schedule ${schedule.id}`);
  } else {
    const errMsg = result.blocked
      ? `Blocked: ${getErrorMessage(result.error)}`
      : `Failed: ${getErrorMessage(result.error)}`;
    console.warn(`[Scheduler] Schedule ${schedule.id}: ${errMsg}`);

    if (result.blocked) {
      await db.update(scheduledUploads).set({
        lastRunAt: new Date(),
      }).where(eq(scheduledUploads.id, schedule.id));
    }

    await db.insert(operations).values({
      userId: schedule.userId,
      jobType: "scheduled_upload",
      status: result.blocked ? "skipped" : "failed",
      relatedEntityType: "scheduled_upload",
      relatedEntityId: schedule.id,
      errorMessage: result.blocked ? undefined : getErrorMessage(result.error),
    });
  }
}

async function wasVideoAlreadyUploaded(channelId: string, sourceVideoId: string): Promise<boolean> {
  const rows = await db
    .select({ id: videoQueue.id })
    .from(videoQueue)
    .where(and(
      eq(videoQueue.targetChannelId, channelId),
      eq(videoQueue.sourceVideoId, sourceVideoId),
      eq(videoQueue.status, "uploaded")
    ));
  return rows.length > 0;
}

function extractTikTokId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/video\/(\d+)/);
  return match?.[1] ?? null;
}

async function findOldestPending(channelId: string) {
  const [item] = await db
    .select()
    .from(videoQueue)
    .where(and(eq(videoQueue.targetChannelId, channelId), eq(videoQueue.status, "pending")))
    .orderBy(videoQueue.createdAt)
    .limit(1);
  return item;
}

async function retryFailedItems() {
  const items = await db.select({ id: videoQueue.id, retryCount: videoQueue.retryCount })
    .from(videoQueue)
    .where(and(eq(videoQueue.status, "failed"), sql`${videoQueue.retryCount} < 5`));

  for (const item of items) {
    await db.update(videoQueue).set({ status: "pending", progress: 0 }).where(eq(videoQueue.id, item.id));
  }

  if (items.length > 0) {
    console.log(`[Scheduler] Retry: reset ${items.length} failed items to pending`);
  }
}

async function processContinuousUploads() {
  const allChannels = await db.select().from(channels).where(eq(channels.authStatus, "authorized"));
  const scheduledChannelIds = new Set(
    (await db.select({ channelId: scheduledUploads.channelId }).from(scheduledUploads).where(eq(scheduledUploads.active, true)))
      .map(s => s.channelId).filter(Boolean)
  );

  for (const channel of allChannels) {
    try {
      if (scheduledChannelIds.has(channel.id)) continue;
      const maxPerDay = await getMaxVideosPerDayForChannel(channel.id);
      const todayCount = await getTodayUploadCountByChannel(channel.id);
      if (todayCount >= maxPerDay) continue;

      if (channel.gcpCredentialId) {
        const [gcp] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
        if (gcp && (gcp.status === "blocked" || gcp.status === "expired")) continue;

        const gcpCount = await getTodayUploadCountByGcp(channel.gcpCredentialId);
        const [chCountRow] = await db.select({ cnt: sql<number>`count(*)::int` })
          .from(channels).where(eq(channels.gcpCredentialId, channel.gcpCredentialId));
        const chCount = chCountRow?.cnt ?? 1;
        const gcpMax = chCount <= 1 ? 3 : chCount === 2 ? 4 : 3;
        if (gcpCount >= gcpMax) continue;
      }

      const queueItem = await findOldestPending(channel.id);
      if (!queueItem) continue;

      // Dead-letter items with expired CDN URLs and no sourceVideoId
      if (queueItem.sourceUrl?.includes("tiktokcdn") && !queueItem.sourceVideoId) {
        await db.update(videoQueue).set({
          status: "dead_letter",
          errorMessage: "Expired CDN URL with no sourceVideoId",
        }).where(eq(videoQueue.id, queueItem.id));
        console.warn(`[ContinuousUpload] Dead-lettering item ${queueItem.id}: expired CDN URL, no sourceVideoId`);
        continue;
      }

      const lease = await checkAndReclaimChannelLease(db, videoQueue, channel.id);
      if (lease.blocked) continue;

      if (lease.reclaimedItemId) {
        console.log(`[ContinuousUpload] Reclaimed stale lease on item ${lease.reclaimedItemId} for ${channel.channelName}`);
      }

      console.log(`[ContinuousUpload] Uploading item ${queueItem.id} for ${channel.channelName}`);
      const result = await runUploadPipeline({ queueItem, channel, context: "continuous" });

      if (result.success) {
        console.log(`[ContinuousUpload] Success: item ${queueItem.id} for ${channel.channelName}`);
      } else {
        console.warn(`[ContinuousUpload] Failed: item ${queueItem.id} for ${channel.channelName}: ${getErrorMessage(result.error)}`);
      }
    } catch (err) {
      console.warn(`[ContinuousUpload] Error for ${channel.channelName}: ${getErrorMessage(err)}`);
    }
  }
}

export interface RefillResult {
  queued: number;
  pendingBefore: number;
  pendingAfter: number;
  exhausted: boolean;
  skipped: boolean;
}

/**
 * Centralized function to fill a source's pending queue up to maxPerSource.
 * Uses pg_try_advisory_xact_lock to prevent concurrent refills of the same source.
 * Re-checks pending count before each individual INSERT to stay within limit.
 * Checks plan queueSize limit.
 * Respects refillThrottle unless skipThrottle is true.
 */
export async function refillSourceToLimit(
  sourceId: string,
  options?: { maxPerSource?: number; skipThrottle?: boolean }
): Promise<RefillResult> {
  const maxPerSource = options?.maxPerSource ?? 5;
  const skipThrottle = options?.skipThrottle ?? false;
  const def = { queued: 0, pendingBefore: 0, pendingAfter: 0, exhausted: false, skipped: true };

  if (!skipThrottle && refillThrottle[sourceId] && Date.now() < refillThrottle[sourceId]) {
    return { ...def, skipped: true };
  }

  const [lockRow] = await db.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${sourceId})::bigint) AS locked`);
  if (!lockRow || (lockRow as any).locked !== true) {
    return { ...def, skipped: true };
  }

  const [src] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!src) return def;

  const filter = (src.contentFilter as any) || {};
  if (filter.autoRefillEnabled === false) return def;

  let workspaceId: string | null = null;
  if (src.linkedChannelId) {
    const [ch] = await db.select({ authStatus: channels.authStatus, workspaceId: channels.workspaceId })
      .from(channels).where(eq(channels.id, src.linkedChannelId));
    if (!ch || ch.authStatus !== "authorized") {
      if (src.status !== "error") {
        await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
      }
      return def;
    }
    workspaceId = ch.workspaceId;
    if (src.status === "error") {
      await db.update(sources).set({ status: "active", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
    }
  }

  const pendingCount = (await db.select({ id: videoQueue.id }).from(videoQueue)
    .where(and(eq(videoQueue.sourceId, sourceId), eq(videoQueue.status, "pending")))).length;

  if (pendingCount >= maxPerSource) {
    return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, skipped: true };
  }

  const planCheck = await checkQueueSizeLimit(src.userId);
  if (!planCheck.allowed) {
    console.warn(`[Refill] Source ${src.accountHandle || src.id}: plan queueSize limit (${planCheck.current}/${planCheck.limit})`);
    return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, skipped: true };
  }

  const cookiesPath = await resolveCookiesPath(workspaceId);
  const proxyUrl = await resolveProxyUrl(src.proxyId);

  const urlOrHandle = src.accountHandle || src.accountUrl;
  if (!urlOrHandle) return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, skipped: true };

  const maxAgeMinutes = Math.min(filter.maxAge || 10080, 525600);
  const sortBy = filter.sortBy || "oldest";
  const minViews = Math.max(filter.minViews || 0, 0);

  let allVideos: any[] = [];
  const MAX_RETRIES = 2;
  let lastFetchErr: any;
  let ytdlpFailed = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (isTikTokUsername(urlOrHandle)) {
        allVideos = await fetchTikTokUserVideosViaYtDlp(urlOrHandle, cookiesPath, proxyUrl);
      } else {
        allVideos = [await fetchTikTokVideoViaYtDlp(urlOrHandle, cookiesPath, proxyUrl)];
      }
      break;
    } catch (err: any) {
      lastFetchErr = err;
      if (isRealTikError(err?.message || "")) { ytdlpFailed = true; break; }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.min(5000 * Math.pow(2, attempt - 1), 30000)));
      } else {
        ytdlpFailed = true;
      }
    }
  }
  if (allVideos.length === 0 && ytdlpFailed) {
    try {
      if (isTikTokUsername(urlOrHandle)) {
        allVideos = await fetchTikTokUserVideos(urlOrHandle, { proxyUrl });
      } else {
        allVideos = [await fetchTikTokVideo(urlOrHandle, { proxyUrl })];
      }
    } catch (tikwmErr: any) {
      console.warn(`[Refill] tikwm fallback failed for ${urlOrHandle}: ${tikwmErr.message}`);
    }
  }

  if (allVideos.length === 0) {
    if (lastFetchErr && isRealTikError(lastFetchErr?.message || "")) {
      await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
    } else if (pendingCount === 0) {
      await db.update(sources).set({ status: "empty", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
    }
    if (!skipThrottle) refillThrottle[sourceId] = Date.now() + REFILL_THROTTLE_MS;
    return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, exhausted: true };
  }

  await db.update(sources).set({ status: "active", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));

  const existing = await db.select({ sourceVideoId: videoQueue.sourceVideoId }).from(videoQueue)
    .where(and(eq(videoQueue.sourceId, src.id), sql`${videoQueue.status} IN ('pending', 'processing', 'uploaded', 'failed')`, isNotNull(videoQueue.sourceVideoId)));
  const existingIds = new Set(existing.map((q: any) => q.sourceVideoId));

  let available = allVideos.filter((v: any) => !existingIds.has(v.id));

  if (available.length === 0) {
    const allUsed = await db.select({ sourceVideoId: videoQueue.sourceVideoId }).from(videoQueue)
      .where(and(eq(videoQueue.sourceId, src.id), isNotNull(videoQueue.sourceVideoId)));
    const allUsedIds = new Set(allUsed.map((q: any) => q.sourceVideoId));
    if (allVideos.length > 0 && allVideos.every((v: any) => allUsedIds.has(v.id))) {
      await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
      console.warn(`[Refill] Source ${src.accountHandle || src.id}: all ${allVideos.length} videos exhausted`);
      if (!skipThrottle) refillThrottle[sourceId] = Date.now() + REFILL_THROTTLE_MS;
      return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, exhausted: true };
    }
    if (!skipThrottle) refillThrottle[sourceId] = Date.now() + REFILL_THROTTLE_MS;
    return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, skipped: true };
  }

  if (maxAgeMinutes > 0) {
    const cutoffMs = Date.now() - maxAgeMinutes * 60 * 1000;
    available = available.filter((v: any) => {
      if (v.timestamp) return v.timestamp * 1000 >= cutoffMs;
      if (v.upload_date) {
        if (maxAgeMinutes < 1440) return true;
        const year = parseInt(v.upload_date.slice(0, 4));
        const month = parseInt(v.upload_date.slice(4, 6)) - 1;
        const day = parseInt(v.upload_date.slice(6, 8));
        return new Date(year, month, day) >= new Date(cutoffMs);
      }
      return true;
    });
  }

  if (sortBy === "most_viewed") {
    if (minViews > 0) available = available.filter((v: any) => (v.likeCount || 0) >= minViews);
    available.sort((a: any, b: any) => (b.likeCount || 0) - (a.likeCount || 0));
  } else if (sortBy === "oldest") {
    if (minViews > 0) available = available.filter((v: any) => (v.likeCount || 0) >= minViews);
    available.reverse();
  } else {
    if (minViews > 0) available = available.filter((v: any) => (v.likeCount || 0) >= minViews);
  }

  const queueAmount = Math.max(0, maxPerSource - pendingCount);
  const toQueue = available.slice(0, queueAmount);

  if (toQueue.length === 0) {
    if (!skipThrottle) refillThrottle[sourceId] = Date.now() + REFILL_THROTTLE_MS;
    return { ...def, pendingBefore: pendingCount, pendingAfter: pendingCount, skipped: true };
  }

  let inserted = 0;
  for (const video of toQueue) {
    const currentPending = (await db.select({ id: videoQueue.id }).from(videoQueue)
      .where(and(eq(videoQueue.sourceId, sourceId), eq(videoQueue.status, "pending")))).length;
    if (currentPending >= maxPerSource) break;

    const planNow = await checkQueueSizeLimit(src.userId);
    if (!planNow.allowed) break;

    try {
      await db.insert(videoQueue).values({
        userId: src.userId,
        sourceId: src.id,
        targetChannelId: src.linkedChannelId || undefined,
        sourceUrl: `${video.authorUrl}/video/${video.id}`,
        sourceVideoId: video.id,
        sourcePlatform: src.platform,
        title: video.title,
        thumbnailUrl: video.coverUrl,
        srcViews: video.playCount || 0,
        srcLikes: video.likeCount || 0,
        status: "pending",
      });
      inserted++;
    } catch (insertErr: any) {
      if (insertErr?.code === "23505") continue;
      throw insertErr;
    }
  }

  const totalAfter = pendingCount + inserted;
  console.log(`[Refill] Source ${src.accountHandle || src.id}: queued ${inserted} (pending ${pendingCount}→${totalAfter})`);

  if (!skipThrottle) refillThrottle[sourceId] = Date.now() + REFILL_THROTTLE_MS;

  return { queued: inserted, pendingBefore: pendingCount, pendingAfter: totalAfter, exhausted: false, skipped: false };
}

async function processAutoRefill() {
  const allSources = await db.select().from(sources);

  for (const src of allSources) {
    try {
      const filter = (src.contentFilter as any) || {};
      if (filter.autoRefillEnabled === false) continue;

      if (refillThrottle[src.id] && Date.now() < refillThrottle[src.id]) continue;

      const result = await refillSourceToLimit(src.id, { maxPerSource: 5, skipThrottle: false });

      if (!result.skipped && result.queued > 0) {
        console.log(`[AutoRefill] Source ${src.accountHandle || src.id}: queued ${result.queued} (pending ${result.pendingBefore}→${result.pendingAfter})`);
      } else if (result.exhausted) {
        console.warn(`[AutoRefill] Source ${src.accountHandle || src.id}: exhausted`);
      }
    } catch (srcErr: any) {
      console.warn(`[AutoRefill] Source ${src.accountHandle || src.id} error: ${getErrorMessage(srcErr)}`);
    }
    await sleep(6000);
  }
}

/**
 * Trigger immediate refill for a specific source (used after video upload)
 * Respects refill throttle to prevent hammering TikTok API.
 */
export async function triggerSourceRefill(sourceId: string): Promise<void> {
  try {
    if (refillThrottle[sourceId] && Date.now() < refillThrottle[sourceId]) return;

    const result = await refillSourceToLimit(sourceId, { maxPerSource: 5, skipThrottle: false });

    if (result.queued > 0) {
      console.log(`[TriggerRefill] Source ${sourceId}: queued ${result.queued} (pending ${result.pendingBefore}→${result.pendingAfter})`);
    } else if (result.skipped) {
      console.log(`[TriggerRefill] Source ${sourceId}: skipped (pending=${result.pendingBefore})`);
    } else if (result.exhausted) {
      console.warn(`[TriggerRefill] Source ${sourceId}: exhausted`);
    }
  } catch (err: any) {
    console.warn(`[TriggerRefill] Source ${sourceId} error: ${getErrorMessage(err)}`);
  }
}

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

async function cleanupUploadedQueue() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  try {
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const oldItems = await db.select({ id: videoQueue.id }).from(videoQueue)
      .where(and(
        sql`${videoQueue.status} IN ('uploaded', 'dead_letter', 'failed', 'cancelled')`,
        lt(videoQueue.createdAt, cutoff)
      ));
    if (oldItems.length > 0) {
      const oldIds = oldItems.map((r: any) => r.id);
      await db.delete(copyrightClaims).where(inArray(copyrightClaims.videoId, oldIds));
      await db.delete(scheduledUploads).where(inArray(scheduledUploads.queueItemId, oldIds));
      await db.delete(videoComments).where(inArray(videoComments.videoId, oldIds));
    }

    await db.execute(
      sql`DELETE FROM video_queue WHERE status IN ('uploaded', 'dead_letter', 'failed', 'cancelled') AND created_at < ${cutoff}`
    );
    console.log(`[Scheduler] Cleaned up old items (>30 days)`);
  } catch (err: any) {
    console.error(`[Scheduler] Queue cleanup error: ${getErrorMessage(err)}`);
  }
}
