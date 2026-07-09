import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { workspaces } from "../../../../lib/db/src/schema/workspaces.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { videoComments } from "../../../../lib/db/src/schema/video-comments.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { analyticsDaily } from "../../../../lib/db/src/schema/analytics-daily.js";
import { analytics } from "../../../../lib/db/src/schema/analytics.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { readJsonFromFilebase } from "../lib/filebase.js";
import { getOAuthUrl } from "../lib/youtube.js";
import { gcpCredentials } from "../../../../lib/db/src/schema/gcp-credentials.js";
import { triggerSourceRefill } from "../workers/scheduler.js";

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select({
      id: channels.id,
      userId: channels.userId,
      workspaceId: channels.workspaceId,
      youtubeChannelId: channels.youtubeChannelId,
      channelName: channels.channelName,
      channelHandle: channels.channelHandle,
      thumbnailUrl: channels.thumbnailUrl,
      sourceId: channels.sourceId,
      gcpCredentialId: channels.gcpCredentialId,
      authStatus: channels.authStatus,
      videosUploaded: channels.videosUploaded,
      quotaUsed: channels.quotaUsed,
      isActive: channels.isActive,
      createdAt: channels.createdAt,
      workspaceName: workspaces.name,
      workspaceEmail: workspaces.email,
    }).from(channels)
      .leftJoin(workspaces, eq(channels.workspaceId, workspaces.id))
      .where(eq(channels.userId, req.userId!));
    // Enrich with GCP credential name
    const creds = await db.select().from(gcpCredentials);
    const credMap = new Map(creds.map(c => [c.id, c.name]));

    // Calculate today's upload count for each channel
    const channelIds = list.map(ch => ch.id);
    const todayCounts = new Map<string, number>();
    if (channelIds.length > 0) {
      const counts = await db.select({
        channelId: videoQueue.targetChannelId,
        count: sql<number>`count(*)::int`,
      }).from(videoQueue)
        .where(and(
          sql`${videoQueue.targetChannelId} IN ${channelIds}`,
          eq(videoQueue.status, "uploaded"),
          sql`date_trunc('day', ${videoQueue.uploadedAt}) = date_trunc('day', NOW())`
        ))
        .groupBy(videoQueue.targetChannelId);
      for (const row of counts) {
        if (row.channelId) todayCounts.set(row.channelId, row.count);
      }
    }

    const enriched = list.map(ch => ({
      ...ch,
      gcpCredentialName: ch.gcpCredentialId ? credMap.get(ch.gcpCredentialId) || null : null,
      uploadsToday: todayCounts.get(ch.id) || 0,
    }));
    res.json(enriched);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/import", async (req: AuthRequest, res) => {
  try {
    const { sourceUrl, channelName, youtubeChannelId, gmail } = req.body;

    // 1. Find or create workspace by Gmail
    const existing = await db.select().from(workspaces)
      .where(and(eq(workspaces.userId, req.userId!), eq(workspaces.email, gmail)))
      .limit(1);
    let workspace = existing[0];
    if (!workspace) {
      const [ws] = await db.insert(workspaces).values({
        userId: req.userId!, email: gmail,
      }).returning();
      workspace = ws;
    }

    // 2. Create channel linked to workspace
    const [channel] = await db.insert(channels).values({
      userId: req.userId!,
      workspaceId: workspace.id,
      youtubeChannelId,
      channelName,
      authStatus: "pending",
    }).returning();

    // 3. Create TikTok source linked to channel
    const [source] = await db.insert(sources).values({
      userId: req.userId!,
      platform: "tiktok",
      accountUrl: sourceUrl,
      linkedChannelId: channel.id,
      status: "active",
    }).returning();

    // 4. Link source back to channel
    await db.update(channels).set({ sourceId: source.id })
      .where(eq(channels.id, channel.id));

    res.status(201).json({ channel: { ...channel, sourceId: source.id }, workspace, source });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/batch-import", async (req: AuthRequest, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }
    const results: any[] = [];
    const errors: any[] = [];
    for (const row of rows) {
      try {
        const { tiktokUsername, channelName, youtubeChannelId, gmail } = row;
        if (!tiktokUsername || !channelName || !youtubeChannelId || !gmail) {
          errors.push({ row, error: "Missing required fields" });
          continue;
        }
        const existing = await db.select().from(workspaces)
          .where(and(eq(workspaces.userId, req.userId!), eq(workspaces.email, gmail)))
          .limit(1);
        let workspace = existing[0];
        if (!workspace) {
          const [ws] = await db.insert(workspaces).values({
            userId: req.userId!, email: gmail,
          }).returning();
          workspace = ws;
        }
        const [channel] = await db.insert(channels).values({
          userId: req.userId!,
          workspaceId: workspace.id,
          youtubeChannelId,
          channelName,
          authStatus: "pending",
        }).returning();
        const [source] = await db.insert(sources).values({
          userId: req.userId!,
          platform: "tiktok",
          accountHandle: tiktokUsername,
          accountUrl: tiktokUsername,
          linkedChannelId: channel.id,
          status: "active",
        }).returning();
        await db.update(channels).set({ sourceId: source.id })
          .where(eq(channels.id, channel.id));
        results.push({ channelId: channel.id, channelName, youtubeChannelId, gmail });
      } catch (e: any) {
        errors.push({ row, error: e.message });
      }
    }
    res.status(201).json({ imported: results.length, errors: errors.length, results, errorDetails: errors });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const chId = req.params.id as string;
    const [ch] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    if (ch.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const ALLOWED = [
      "channelName", "channelHandle", "thumbnailUrl", "gcpCredentialId",
      "authStatus", "isActive", "youtubeChannelId", "sourceId",
    ];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) {
      if (key in req.body) safe[key] = req.body[key];
    }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const updated = await db.update(channels).set(safe).where(eq(channels.id, chId)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const chId = req.params.id as string;
    const [ch] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    if (ch.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(scheduledUploads).where(eq(scheduledUploads.channelId, chId));
    await db.delete(videoComments).where(eq(videoComments.channelId, chId));
    await db.delete(copyrightClaims).where(eq(copyrightClaims.channelId, chId));
    await db.delete(analyticsDaily).where(eq(analyticsDaily.channelId, chId));
    await db.delete(analytics).where(eq(analytics.channelId, chId));
    await db.delete(videoQueue).where(eq(videoQueue.targetChannelId, chId));
    await db.delete(sources).where(eq(sources.linkedChannelId, chId));
    await db.delete(channels).where(eq(channels.id, chId));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/authorize", async (req: AuthRequest, res) => {
  try {
    const chId = req.params.id as string;
    const [channel] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, channel.workspaceId!));
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    let clientId: string;
    let clientSecret: string;
    let credName = "";

    // Try assigned GCP credential first
    let cred = null;
    if (channel.gcpCredentialId) {
      const [found] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
      cred = found;
    }
    // If no assigned credential, try to auto-assign the first available GCP credential
    if (!cred) {
      const wsCreds = await db.select().from(gcpCredentials).where(eq(gcpCredentials.workspaceId, workspace.id));
      if (wsCreds.length > 0) {
        cred = wsCreds[0];
        await db.update(channels).set({ gcpCredentialId: cred.id }).where(eq(channels.id, chId));
      }
    }

    if (cred) {
      clientId = cred.clientId!;
      credName = cred.name;
      const credData = await readJsonFromFilebase(cred.oauthFilePath!);
      const web = credData.web || credData.installed || credData;
      clientSecret = web.client_secret;
      if (!clientId || !clientSecret) return res.status(400).json({ error: `GCP credential "${cred.name}" has missing client_id or client_secret.` });
    } else {
      // Fall back to workspace-level client_secret.json
      if (!workspace.oauthFilePath) return res.status(400).json({ error: "No GCP credentials found. Upload a client_secret.json via GCP Projects or run Auto-Assign first." });
      const clientSecretData = await readJsonFromFilebase(workspace.oauthFilePath);
      const web = clientSecretData.web || clientSecretData.installed || clientSecretData;
      clientId = web.client_id;
      clientSecret = web.client_secret;
      if (!clientId) return res.status(400).json({ error: "client_secret.json missing client_id." });
    }

    const redirectUri = `${BACKEND_URL}/api/workspaces/oauth/callback`;
    const state = Buffer.from(`${workspace.id}:${chId}`).toString("base64");

    // Pre-authorize conflict check: warn if GCP project already used by another channel
    let conflictWarning: string | null = null;
    if (cred) {
      const otherChannels = await db.select({ id: channels.id, channelName: channels.channelName })
        .from(channels)
        .where(and(eq(channels.gcpCredentialId, cred.id), sql`${channels.id} != ${chId}`));
      if (otherChannels.length > 0) {
        const names = otherChannels.map(c => c.channelName).join(", ");
        conflictWarning = `This GCP project is already used by channel(s): ${names}. Authorizing will assign your Google account to THIS channel.`;
        console.warn(`[Authorize] Conflict warning for ${channel.channelName}: GCP "${cred.name}" already used by ${names}`);
      }
    }

    // Clear stale channel info before re-authorizing — callback will set fresh values
    await db.update(channels).set({ youtubeChannelId: null, channelHandle: null, authStatus: "pending" }).where(eq(channels.id, chId));
    const authUrl = await getOAuthUrl(clientId, redirectUri, state);
    res.json({ success: true, redirectUrl: authUrl, redirectUri, channelId: chId, gcpCredential: credName || null, conflictWarning });
  } catch (err: any) {
    console.error("[Authorize error]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/count", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(channels).where(eq(channels.userId, req.userId!));
    res.json({ count: list.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/auth/issues", async (req: AuthRequest, res) => {
  try {
    const list = await db.select({
      id: channels.id,
      channelName: channels.channelName,
      youtubeChannelId: channels.youtubeChannelId,
      authStatus: channels.authStatus,
      workspaceId: channels.workspaceId,
      gcpCredentialId: channels.gcpCredentialId,
    }).from(channels)
      .where(and(eq(channels.userId, req.userId!), eq(channels.authStatus, "failed")));

    const wsIds = [...new Set(list.map(ch => ch.workspaceId).filter(Boolean))] as string[];
    const credIds = [...new Set(list.map(ch => ch.gcpCredentialId).filter(Boolean))] as string[];

    const wsList = wsIds.length > 0
      ? await db.select({ id: workspaces.id, email: workspaces.email }).from(workspaces).where(inArray(workspaces.id, wsIds))
      : [];
    const credList = credIds.length > 0
      ? await db.select({ id: gcpCredentials.id, name: gcpCredentials.name }).from(gcpCredentials).where(inArray(gcpCredentials.id, credIds))
      : [];

    const wsMap = new Map(wsList.map(w => [w.id, w.email]));
    const credMap = new Map(credList.map(c => [c.id, c.name]));

    const enriched = list.map(ch => ({
      ...ch,
      workspaceEmail: wsMap.get(ch.workspaceId || "") || null,
      gcpCredentialName: credMap.get(ch.gcpCredentialId || "") || null,
    }));

    res.json({ count: enriched.length, channels: enriched });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auto-refill/bulk", async (req: AuthRequest, res) => {
  try {
    const { enabled, sortBy, minViews, maxAge } = req.body;

    const userChannels = await db.select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.userId, req.userId!), eq(channels.authStatus, "authorized")));

    let updatedCount = 0;
    const updatedSourceIds: string[] = [];
    for (const ch of userChannels) {
      const [src] = await db.select().from(sources).where(eq(sources.linkedChannelId, ch.id));
      if (!src) continue;
      await db.update(sources).set({
        contentFilter: {
          autoRefillEnabled: enabled !== false,
          sortBy: sortBy || "oldest",
          minViews: Math.max(minViews || 0, 0),
          maxAge: Math.min(maxAge || 10080, 525600),
        },
      }).where(eq(sources.id, src.id));
      updatedCount++;
      updatedSourceIds.push(src.id);
    }

    // Trigger refill for each source after saving settings
    for (const srcId of updatedSourceIds) {
      triggerSourceRefill(srcId).catch((err: any) => {
        console.warn(`[AutoRefillBulk] Trigger refill failed for source ${srcId}: ${err?.message}`);
      });
    }

    res.json({ success: true, updatedSources: updatedCount, totalChannels: userChannels.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
