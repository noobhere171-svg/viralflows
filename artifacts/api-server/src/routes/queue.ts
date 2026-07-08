import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { operations } from "../../../../lib/db/src/schema/operations.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateSeo } from "../lib/llm.js";
import { readJsonFromFilebase } from "../lib/filebase.js";
import { runUploadPipeline } from "../../../../lib/upload-pipeline.js";
import { getErrorMessage } from "../../../../lib/errors.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const { status, channelId, sourceId, page: pageStr } = req.query;

    let conditions = [eq(videoQueue.userId, req.userId!)];
    if (status) conditions.push(eq(videoQueue.status, status as string));
    if (channelId) conditions.push(eq(videoQueue.targetChannelId, channelId as string));
    if (sourceId) conditions.push(eq(videoQueue.sourceId, sourceId as string));

    if (pageStr) {
      const page = Math.max(1, parseInt(pageStr, 10) || 1);
      const limit = 50;
      const list = await db.select().from(videoQueue)
        .where(and(...conditions))
        .orderBy(desc(videoQueue.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      const [{ total }] = await db.select({ total: sql<number>`count(*)` })
        .from(videoQueue)
        .where(and(...conditions));

      return res.json({ list, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    const list2 = await db.select().from(videoQueue)
      .where(and(...conditions))
      .orderBy(desc(videoQueue.createdAt))
      .limit(200);

    return res.json(list2);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { sourceUrl, sourcePlatform, targetChannelId, title, description, tags, category, sourceId } = req.body;
    const item = await db.insert(videoQueue).values({
      userId: req.userId!, sourceUrl, sourcePlatform, targetChannelId, title, description, tags, category, sourceId,
    }).returning();
    res.status(201).json(item[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const [item] = await db.select().from(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    if (!item) return res.status(404).json({ error: "Queue item not found" });
    if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const ALLOWED = ["title","description","tags","category","visibility","priority","scheduledAt","status","targetChannelId","progress"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (safe.scheduledAt && typeof safe.scheduledAt === "string") {
      safe.scheduledAt = new Date(safe.scheduledAt);
    }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const updated = await db.update(videoQueue).set(safe).where(eq(videoQueue.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [item] = await db.select().from(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    if (!item) return res.status(404).json({ error: "Queue item not found" });
    if (item.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.update(scheduledUploads).set({ queueItemId: null })
      .where(eq(scheduledUploads.queueItemId, req.params.id as string));
    await db.delete(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/generate-seo", async (req: AuthRequest, res) => {
  try {
    const [item] = await db.select().from(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    if (!item) return res.status(404).json({ error: "Queue item not found" });

    const seo = await generateSeo(item.title || "Untitled video", item.sourcePlatform || "tiktok");

    const [updated] = await db.update(videoQueue).set({
      title: seo.title,
      description: seo.description,
      tags: seo.tags,
      category: seo.category,
    }).where(eq(videoQueue.id, item.id)).returning();

    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/upload-now", async (req: AuthRequest, res) => {
  try {
    const [item] = await db.select().from(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    if (!item) return res.status(404).json({ error: "Queue item not found" });

    let targetChannelId = item.targetChannelId;
    if (!targetChannelId && item.sourceId) {
      const [src] = await db.select().from(sources).where(eq(sources.id, item.sourceId));
      if (src?.linkedChannelId) targetChannelId = src.linkedChannelId;
    }
    if (!targetChannelId) return res.status(400).json({ error: "No target channel. Open SEO editor and select a channel first." });

    const [channel] = await db.select().from(channels).where(eq(channels.id, targetChannelId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    if (channel.authStatus !== "authorized") {
      return res.status(400).json({ error: `Channel "${channel.channelName}" is not authorized` });
    }

    const result = await runUploadPipeline({
      queueItem: item,
      channel,
      context: "upload-now button",
    });

    if (result.success) {
      await db.insert(operations).values({
        userId: req.userId!,
        jobType: "youtube_upload",
        status: "completed",
        relatedEntityType: "video_queue",
        relatedEntityId: item.id,
        logs: { videoId: result.youtubeVideoId },
      });

      return res.json({ success: true, videoId: result.youtubeVideoId });
    }

    if (result.blocked) {
      return res.status(409).json({ success: false, error: getErrorMessage(result.error) });
    }

    return res.status(502).json({ success: false, error: getErrorMessage(result.error) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/retry", async (req: AuthRequest, res) => {
  try {
    const updated = await db.update(videoQueue).set({ status: "pending", errorMessage: null }).where(eq(videoQueue.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/youtube-delete", async (req: AuthRequest, res) => {
  try {
    const [item] = await db.select().from(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    if (!item) return res.status(404).json({ error: "Queue item not found" });
    if (!item.youtubeVideoId) return res.status(400).json({ error: "No YouTube video ID to delete" });

    const [channel] = await db.select().from(channels).where(eq(channels.id, item.targetChannelId!));
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    let tokens: any;
    try {
      tokens = await readJsonFromFilebase(`workspaces/${channel.workspaceId}/oauth-tokens-${channel.id}.json`);
    } catch {}
    if (!tokens?.access_token) {
      try { tokens = await readJsonFromFilebase(`workspaces/${channel.workspaceId}/oauth-tokens.json`); } catch {
        return res.status(400).json({ error: "YouTube not authorized" });
      }
    }

    let clientId: string | undefined;
    let clientSecret: string | undefined;
    try {
      const csPath = `workspaces/${channel.workspaceId}/client_secret.json`;
      const csData = await readJsonFromFilebase(csPath);
      const web = csData.web || csData.installed || csData;
      clientId = web.client_id;
      clientSecret = web.client_secret;
    } catch {}

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    await youtube.videos.delete({ id: item.youtubeVideoId });

    await db.update(videoQueue).set({ status: "deleted", youtubeVideoId: null }).where(eq(videoQueue.id, item.id));

    res.json({ success: true, message: "Video deleted from YouTube" });
  } catch (err: any) {
    res.status(502).json({ error: `YouTube delete failed: ${err.message}` });
  }
});

router.get("/count", async (req: AuthRequest, res) => {
  try {
    const rows = await db.select({
      status: videoQueue.status,
      count: sql<number>`count(*)`,
    }).from(videoQueue)
      .where(eq(videoQueue.userId, req.userId!))
      .groupBy(videoQueue.status);

    let total = 0;
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.status] = Number(r.count);
      total += Number(r.count);
    }
    res.json({
      total,
      pending: counts.pending || 0,
      processing: counts.processing || 0,
      uploaded: counts.uploaded || 0,
      failed: counts.failed || 0,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
