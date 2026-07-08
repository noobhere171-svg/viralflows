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

    const queueItems: any[] = [];
    for (const video of selected) {
      const [queueItem] = await db.insert(videoQueue).values({
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

      try {
        const seo = await generateSeo(video.title || "Untitled", src.platform);
        await db.update(videoQueue).set({
          title: seo.title, description: seo.description, tags: seo.tags, category: seo.category,
        }).where(eq(videoQueue.id, queueItem.id));
        queueItem.title = seo.title;
        queueItem.description = seo.description;
        queueItem.tags = seo.tags;
        queueItem.category = seo.category;
      } catch {}

      queueItems.push(queueItem);
    }

    res.json({ success: true, queued: queueItems.length, queueItems });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/refill", async (req: AuthRequest, res) => {
  try {
    const [src] = await db.select().from(sources).where(eq(sources.id, req.params.id as string));
    if (!src) return res.status(404).json({ error: "Source not found" });

    let workspaceId: string | null = null;

    // Check channel is authorized before refilling
    if (src.linkedChannelId) {
      const [ch] = await db.select({ authStatus: channels.authStatus, workspaceId: channels.workspaceId })
        .from(channels).where(eq(channels.id, src.linkedChannelId));
      if (!ch || ch.authStatus !== "authorized") {
        return res.status(400).json({ error: `Cannot refill: linked channel auth status is "${ch?.authStatus}". Only authorized channels can refill.` });
      }
      workspaceId = ch.workspaceId;
    }

    const cookiesPath = workspaceId && await hasWorkspaceCookies(workspaceId) ? getWorkspaceCookiesPath(workspaceId) : undefined;

    const filter = (src.contentFilter || {}) as any;
    const maxAgeMinutes = Math.min(filter.maxAge || 10080, 525600);
    const sortBy = filter.sortBy || "oldest";
    const minViews = Math.max(filter.minViews || 0, 0);
    const REFILL_AMOUNT = 5;

    const urlOrHandle = src.accountHandle || src.accountUrl;
    if (!urlOrHandle) return res.status(400).json({ error: "No handle/URL configured" });

    // Skip if already enough queued
    const [{ count: existingCount }] = await db.select({ count: sql<number>`count(*)` })
      .from(videoQueue)
      .where(and(eq(videoQueue.sourceId, src.id), eq(videoQueue.status, "pending")));
    if (Number(existingCount) >= REFILL_AMOUNT) {
      return res.json({ success: true, queued: 0, queueItems: [], message: "Already enough queued" });
    }

    let allVideos: Awaited<ReturnType<typeof fetchTikTokUserVideos>> = [];
    if (isTikTokUsername(urlOrHandle)) {
      allVideos = await fetchTikTokUserVideosViaYtDlp(urlOrHandle, cookiesPath).catch(() => fetchTikTokUserVideos(urlOrHandle));
    } else {
      const single = await fetchTikTokVideoViaYtDlp(urlOrHandle, cookiesPath).catch(() => fetchTikTokVideo(urlOrHandle));
      allVideos = [single];
    }

    // Exclude already-used videos (match by sourceVideoId)
    const existing = await db.select({ sourceVideoId: videoQueue.sourceVideoId })
      .from(videoQueue)
      .where(and(eq(videoQueue.sourceId, src.id), eq(videoQueue.userId, src.userId), eq(videoQueue.status, "pending"), isNotNull(videoQueue.sourceVideoId)));
    const existingIds = new Set(existing.map(q => q.sourceVideoId));

    let available = allVideos.filter(v => !existingIds.has(v.id));

    // Filter by maxAge
    if (maxAgeMinutes > 0) {
      const cutoffMs = Date.now() - maxAgeMinutes * 60 * 1000;
      available = available.filter((v: any) => {
        if (v.timestamp) return v.timestamp * 1000 >= cutoffMs;
        if (v.upload_date) {
          if (maxAgeMinutes < 1440) return true;
          const year = parseInt(v.upload_date.slice(0, 4));
          const month = parseInt(v.upload_date.slice(4, 6)) - 1;
          const day = parseInt(v.upload_date.slice(6, 8));
          const dayCutoff = new Date(cutoffMs);
          dayCutoff.setHours(0, 0, 0, 0);
          return new Date(year, month, day) >= dayCutoff;
        }
        return true;
      });
    }

    if (sortBy === "all" || sortBy === "most_recent") {
      if (minViews > 0) available = available.filter(v => (v.likeCount || 0) >= minViews);
    } else if (sortBy === "oldest") {
      if (minViews > 0) available = available.filter(v => (v.likeCount || 0) >= minViews);
      available.reverse();
    } else if (sortBy === "most_viewed") {
      if (minViews > 0) available = available.filter(v => (v.likeCount || 0) >= minViews);
      available.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }

    const toQueue = available.slice(0, REFILL_AMOUNT);
    if (toQueue.length === 0) {
      const allUsed = await db.select({ sourceVideoId: videoQueue.sourceVideoId }).from(videoQueue)
        .where(and(eq(videoQueue.sourceId, src.id), isNotNull(videoQueue.sourceVideoId)));
      const allUsedIds = new Set(allUsed.map((q: any) => q.sourceVideoId));
      if (allVideos.length > 0 && allVideos.every(v => allUsedIds.has(v.id))) {
        await db.update(sources).set({ status: "error", lastSyncedAt: new Date() }).where(eq(sources.id, src.id));
        return res.json({ success: true, queued: 0, queueItems: [], message: "Source exhausted — all videos used, status set to error" });
      }
      return res.json({ success: true, queued: 0, queueItems: [], message: "No new videos to queue" });
    }

    const queueItems: any[] = [];
    for (const video of toQueue) {
      const [item] = await db.insert(videoQueue).values({
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

      try {
        const seo = await generateSeo(video.title || "Untitled", src.platform);
        await db.update(videoQueue).set({
          title: seo.title, description: seo.description, tags: seo.tags, category: seo.category,
        }).where(eq(videoQueue.id, item.id));
        item.title = seo.title;
        item.description = seo.description;
        item.tags = seo.tags;
        item.category = seo.category;
      } catch {}

      queueItems.push(item);
    }

    res.json({ success: true, queued: queueItems.length, queueItems });
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
    const chIds = list.map(s => s.linkedChannelId).filter(Boolean);
    const channelRows = chIds.length > 0
      ? await db.select({ id: channels.id, channelName: channels.channelName, workspaceId: channels.workspaceId }).from(channels).where(inArray(channels.id, chIds))
      : [];
    const wsIds = [...new Set(channelRows.map(c => c.workspaceId).filter(Boolean))];
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

    const queueItems: any[] = [];

    for (const video of videos) {
      const [queueItem] = await db.insert(videoQueue).values({
        userId: src.userId,
        sourceId: src.id,
        targetChannelId: src.linkedChannelId || undefined,
        title: video.title,
        sourceUrl: `${video.authorUrl}/video/${video.id}`,
        sourceVideoId: video.id,
        sourcePlatform: src.platform,
        thumbnailUrl: video.coverUrl,
        status: "pending",
      }).returning();

      try {
        const seo = await generateSeo(video.title || "Untitled", src.platform);
        await db.update(videoQueue).set({
          title: seo.title,
          description: seo.description,
          tags: seo.tags,
          category: seo.category,
        }).where(eq(videoQueue.id, queueItem.id));
        queueItem.title = seo.title;
        queueItem.description = seo.description;
        queueItem.tags = seo.tags;
        queueItem.category = seo.category;
      } catch {}

      queueItems.push(queueItem);
    }

    await db.insert(operations).values({
      userId: src.userId,
      jobType: "source_sync",
      status: "completed",
      relatedEntityType: "source",
      relatedEntityId: src.id,
      logs: { videosFound: videos.length },
    });

    res.json({ success: true, videosFound: videos.length, queueItems });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
