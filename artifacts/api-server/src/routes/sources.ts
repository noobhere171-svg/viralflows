import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { workspaces } from "../../../../lib/db/src/schema/workspaces.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { operations } from "../../../../lib/db/src/schema/operations.js";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import { fetchTikTokVideo, fetchTikTokUserVideos, fetchTikTokVideoViaYtDlp, fetchTikTokUserVideosViaYtDlp, isTikTokUsername } from "../lib/tiktok.js";
import { withTikwmRetry, isRealTikError } from "../../../../lib/rate-limiter.js";
import { generateSeo } from "../lib/llm.js";
import { hasWorkspaceCookies, getWorkspaceCookiesPath } from "../lib/filebase.js";
import { refillSourceToLimit } from "../workers/scheduler.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(sources).where(eq(sources.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { platform, accountHandle, accountUrl, linkedChannelId, fetchFrequencyHours } = req.body;
    const item = await db.insert(sources).values({
      userId: req.userId!, platform, accountHandle, accountUrl, linkedChannelId, fetchFrequencyHours,
      contentFilter: {
        autoRefillEnabled: true,
        minViews: 0,
        maxAge: 525600,
        sortBy: "oldest",
      },
    }).returning();
    res.status(201).json(item[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const srcId = req.params.id as string;
    const [src] = await db.select().from(sources).where(eq(sources.id, srcId));
    if (!src) return res.status(404).json({ error: "Source not found" });
    if (src.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const ALLOWED = ["platform","accountHandle","accountUrl","linkedChannelId","proxyId","fetchFrequencyHours","contentFilter","status"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const updated = await db.update(sources).set(safe).where(eq(sources.id, srcId)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/videos", async (req: AuthRequest, res) => {
  try {
    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });
    const urlOrHandle = src.accountHandle || src.accountUrl;
    if (!urlOrHandle) return res.status(400).json({ error: "No handle/URL configured" });

    const fetchVideos = async () => {
      if (isTikTokUsername(urlOrHandle)) {
        return await fetchTikTokUserVideosViaYtDlp(urlOrHandle).catch(() => fetchTikTokUserVideos(urlOrHandle));
      }
      return [await fetchTikTokVideoViaYtDlp(urlOrHandle).catch(() => fetchTikTokVideo(urlOrHandle))];
    };

    let videos: Awaited<ReturnType<typeof fetchVideos>> = [];
    try {
      videos = await withTikwmRetry(fetchVideos);
    } catch (err: any) {
      if (isRealTikError(err?.message || "")) {
        return res.status(404).json({ error: err.message });
      }
      return res.status(502).json({ error: `TikTok fetch failed: ${err.message}` });
    }
    res.json(videos);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/queue-selected", async (req: AuthRequest, res) => {
  try {
    const { videoIds } = req.body;
    if (!videoIds?.length) return res.status(400).json({ error: "No video IDs provided" });

    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });

    const urlOrHandle = src.accountHandle || src.accountUrl;
    if (!urlOrHandle) return res.status(400).json({ error: "No handle/URL configured" });

    let allVideos: Awaited<ReturnType<typeof fetchTikTokUserVideos>> = [];
    if (isTikTokUsername(urlOrHandle)) {
      allVideos = await fetchTikTokUserVideosViaYtDlp(urlOrHandle).catch(() => fetchTikTokUserVideos(urlOrHandle));
    } else {
      const single = await fetchTikTokVideoViaYtDlp(urlOrHandle).catch(() => fetchTikTokVideo(urlOrHandle));
      allVideos = [single];
    }

    const selected = allVideos.filter(v => videoIds.includes(v.id));
    if (selected.length === 0) return res.status(404).json({ error: "No matching videos found" });

    // Check current pending count for this source
    const [{ count: existingPending }] = await db.select({ count: sql<number>`count(*)` })
      .from(videoQueue)
      .where(and(eq(videoQueue.sourceId, src.id), eq(videoQueue.status, "pending")));
    const maxPerSource = 5;
    const slotsAvailable = Math.max(0, maxPerSource - Number(existingPending));

    if (slotsAvailable === 0) {
      return res.status(400).json({ error: `Source already has ${existingPending} pending videos (max ${maxPerSource})` });
    }

    const toQueue = selected.slice(0, slotsAvailable);
    const skippedCount = selected.length - toQueue.length;

    const queueItems: any[] = [];
    for (const video of toQueue) {
      // Re-check plan queueSize limit before each insert
      const { checkQueueSizeLimit } = await import("../../../../lib/plan-limits.js");
      const planCheck = await checkQueueSizeLimit(src.userId);
      if (!planCheck.allowed) {
        break;
      }

      let inserted: any;
      try {
        [inserted] = await db.insert(videoQueue).values({
          userId: src.userId,
          sourceId: src.id,
          targetChannelId: src.linkedChannelId || undefined,
          title: video.title,
          sourceUrl: `${video.authorUrl}/video/${video.id}`,
          sourceVideoId: video.id,
          sourcePlatform: src.platform,
          thumbnailUrl: video.coverUrl,
          srcViews: video.playCount || 0,
          srcLikes: video.likeCount || 0,
          status: "pending",
        }).returning();
      } catch (insertErr: any) {
        if (insertErr?.code === "23505") continue;
        throw insertErr;
      }

      try {
        const seo = await generateSeo(video.title || "Untitled", src.platform);
        await db.update(videoQueue).set({
          title: seo.title, description: seo.description, tags: seo.tags, category: seo.category,
        }).where(eq(videoQueue.id, inserted.id));
        inserted.title = seo.title;
        inserted.description = seo.description;
        inserted.tags = seo.tags;
        inserted.category = seo.category ?? null;
      } catch {}

      queueItems.push(inserted);
    }

    res.json({
      success: true,
      queued: queueItems.length,
      skippedDueToLimit: skippedCount,
      queueItems,
      message: skippedCount > 0 ? `${skippedCount} video(s) skipped — source already has ${existingPending} pending (max ${maxPerSource})` : undefined,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/refill", async (req: AuthRequest, res) => {
  try {
    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });

    if (src.linkedChannelId) {
      const [ch] = await db.select({ authStatus: channels.authStatus })
        .from(channels).where(eq(channels.id, src.linkedChannelId));
      if (!ch || ch.authStatus !== "authorized") {
        return res.status(400).json({ error: `Cannot refill: linked channel auth status is "${ch?.authStatus}". Only authorized channels can refill.` });
      }
    }

    const result = await refillSourceToLimit(src.id, { maxPerSource: 5, skipThrottle: true });

    if (result.skipped && result.pendingBefore >= 5) {
      return res.json({ success: true, queued: 0, message: `Already ${result.pendingBefore} pending (max 5)` });
    }
    if (result.exhausted) {
      return res.json({ success: true, queued: 0, message: "Source exhausted — all videos already used" });
    }

    res.json({ success: true, queued: result.queued, pendingBefore: result.pendingBefore, pendingAfter: result.pendingAfter });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });
    if (src.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(videoQueue).where(eq(videoQueue.sourceId, src.id));
    await db.delete(sources).where(eq(sources.id, src.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/health/issues", async (req: AuthRequest, res) => {
  try {
    const list = await db.select({
      id: sources.id,
      platform: sources.platform,
      accountHandle: sources.accountHandle,
      accountUrl: sources.accountUrl,
      status: sources.status,
      linkedChannelId: sources.linkedChannelId,
    }).from(sources).where(
      and(eq(sources.userId, req.userId!), sql`${sources.status} NOT IN ('active', 'pending')`)
    );
    const chIds = list.map(s => s.linkedChannelId).filter(Boolean) as string[];
    const channelRows = chIds.length > 0
      ? await db.select({ id: channels.id, channelName: channels.channelName, workspaceId: channels.workspaceId }).from(channels).where(inArray(channels.id, chIds))
      : [];
    const wsIds = [...new Set(channelRows.map(c => c.workspaceId).filter(Boolean))] as string[];
    const wsRows = wsIds.length > 0
      ? await db.select({ id: workspaces.id, email: workspaces.email }).from(workspaces).where(inArray(workspaces.id, wsIds))
      : [];
    const chMap = new Map(channelRows.map(c => [c.id, c]));
    const wsMap = new Map(wsRows.map(w => [w.id, w.email]));
    const enriched = list.map(s => {
      const ch = chMap.get(s.linkedChannelId || "");
      const chName = ch?.channelName || null;
      const wsEmail = ch?.workspaceId ? wsMap.get(ch.workspaceId) || null : null;
      return { ...s, channelName: chName, workspaceEmail: wsEmail };
    });
    res.json({ count: enriched.length, sources: enriched });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/sync", async (req: AuthRequest, res) => {
  try {
    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });
    const urlOrHandle = src.accountHandle || src.accountUrl;
    if (!urlOrHandle) return res.status(400).json({ error: "Source has no account URL or handle to sync" });

    // Resolve cookies path
    let cookiesPath: string | undefined;
    if (src.linkedChannelId) {
      const [ch] = await db.select({ workspaceId: channels.workspaceId })
        .from(channels).where(eq(channels.id, src.linkedChannelId));
      if (ch?.workspaceId && await hasWorkspaceCookies(ch.workspaceId)) {
        cookiesPath = getWorkspaceCookiesPath(ch.workspaceId);
      }
    }

    let videos: Awaited<ReturnType<typeof fetchTikTokUserVideos>> = [];

    try {
      if (isTikTokUsername(urlOrHandle)) {
        videos = await fetchTikTokUserVideosViaYtDlp(urlOrHandle, cookiesPath).catch(() => fetchTikTokUserVideos(urlOrHandle));
      } else {
        const single = await fetchTikTokVideoViaYtDlp(urlOrHandle, cookiesPath).catch(() => fetchTikTokVideo(urlOrHandle));
        videos = [single];
      }
    } catch (fetchErr: any) {
      if (isRealTikError(fetchErr?.message || "")) {
        await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
      }
      return res.status(502).json({ error: `Failed to fetch videos: ${fetchErr.message}` });
    }

    if (videos.length === 0) {
      await db.update(sources).set({ status: "empty", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
      return res.status(404).json({ error: "No videos found for this source" });
    }

    await db.update(sources).set({ status: "active", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));

    await db.insert(operations).values({
      userId: src.userId,
      jobType: "source_sync",
      status: "completed",
      relatedEntityType: "source",
      relatedEntityId: src.id,
      logs: { videosFound: videos.length },
    });

    res.json({ success: true, videosFound: videos.length, videos });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
