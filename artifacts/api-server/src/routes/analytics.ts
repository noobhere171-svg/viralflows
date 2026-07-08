import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { videoComments } from "../../../../lib/db/src/schema/video-comments.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { analyticsDaily } from "../../../../lib/db/src/schema/analytics-daily.js";
import { workspaces } from "../../../../lib/db/src/schema/workspaces.js";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { readJsonFromFilebase } from "../lib/filebase.js";
import { fetchVideoStats, fetchChannelStats, fetchVideoComments, fetchVideoCopyrightStatus } from "../lib/youtube.js";

const router = Router();
router.use(requireAuth);

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  let start = new Date();
  switch (period || "7d") {
    case "7d": start.setDate(end.getDate() - 7); break;
    case "30d": start.setDate(end.getDate() - 30); break;
    case "90d": start.setDate(end.getDate() - 90); break;
    case "all": start = new Date(0); break;
    default: start.setDate(end.getDate() - 7);
  }
  return { start, end };
}

function getPrevDateRange(period: string): { start: Date; end: Date } {
  const current = getDateRange(period);
  const diff = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - diff), end: current.start };
}

function sumField(items: any[], field: string): number {
  return items.reduce((sum: number, item: any) => sum + (parseInt(item[field]) || 0), 0);
}

router.get("/overview", async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || "7d";
    const channelId = req.query.channelId as string;
    const { start, end } = getDateRange(period);
    const prev = getPrevDateRange(period);

    const userId = req.userId!;
    const userVideos = channelId
      ? await db.select().from(videoQueue).where(and(eq(videoQueue.targetChannelId, channelId), eq(videoQueue.status, "uploaded")))
      : await db.select().from(videoQueue).where(and(eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")));
    const userChannels = channelId
      ? await db.select().from(channels).where(eq(channels.id, channelId))
      : await db.select().from(channels).where(eq(channels.userId, userId));

    const totalViews = sumField(userVideos, "ytViews");
    const totalLikes = sumField(userVideos, "ytLikes");
    const totalComments = sumField(userVideos, "ytComments");
    const subsGained = sumField(userVideos, "ytSubsGained");
    const totalUploads = userVideos.length;
    const copyrightIssues = userVideos.filter((v: any) => v.copyrightStatus && v.copyrightStatus !== "clean").length;

    const periodVideos = userVideos.filter((v: any) => {
      const d = new Date(v.createdAt);
      return d >= start && d <= end;
    });
    const prevVideos = userVideos.filter((v: any) => {
      const d = new Date(v.createdAt);
      return d >= prev.start && d <= prev.end;
    });

    const pv = sumField(prevVideos, "ytViews") || 1;
    const viewsChange = ((sumField(periodVideos, "ytViews") - pv) / pv * 100).toFixed(1);
    const pl = sumField(prevVideos, "ytLikes") || 1;
    const likesChange = ((sumField(periodVideos, "ytLikes") - pl) / pl * 100).toFixed(1);

    const viewsTrend: { date: string; views: number }[] = [];
    const days = Math.min(period === "7d" ? 7 : period === "30d" ? 30 : 90, periodVideos.length || 7);
    for (let i = 0; i < days; i++) {
      const d = new Date(end);
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toISOString().split("T")[0];
      const dayViews = periodVideos.filter((v: any) => {
        const vd = new Date(v.createdAt).toISOString().split("T")[0];
        return vd === dateStr;
      }).reduce((s: number, v: any) => s + (parseInt(v.ytViews) || 0), 0);
      viewsTrend.push({ date: dateStr, views: dayViews });
    }

    const trendingSources: any[] = [];
    if (!channelId) {
      const userSources = await db.select().from(sources).where(eq(sources.userId, userId));
      for (const src of userSources) {
        const srcVids = userVideos.filter((v: any) => v.sourceId === src.id);
        if (srcVids.length === 0) continue;
        trendingSources.push({
          handle: src.accountHandle || "unknown",
          platform: src.platform,
          videos: srcVids.length,
          ytViews: sumField(srcVids, "ytViews"),
        });
      }
      trendingSources.sort((a: any, b: any) => b.ytViews - a.ytViews);
    }

    const trendingVideos = [...userVideos]
      .sort((a: any, b: any) => (parseInt(b.ytViews) || 0) - (parseInt(a.ytViews) || 0))
      .slice(0, 5)
      .map((v: any) => ({
        id: v.id,
        title: v.title,
        channel: userChannels.find((c: any) => c.id === v.targetChannelId)?.channelName || "Unknown",
        ytViews: parseInt(v.ytViews) || 0,
        ytLikes: parseInt(v.ytLikes) || 0,
        youtubeVideoId: v.youtubeVideoId,
      }));

    const subscriberGrowth = userChannels.map((ch: any) => ({
      channelName: ch.channelName,
      subs: ch.totalSubsGained || 0,
    }));

    const bestUploadTimes: { day: string; hour: number; avgViews: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const v of userVideos) {
      const d = new Date(v.createdAt);
      const day = dayNames[d.getDay()];
      const hour = d.getHours();
      const views = parseInt(v.ytViews) || 0;
      bestUploadTimes.push({ day, hour, avgViews: views });
    }
    const aggregated: Record<string, { sum: number; count: number }> = {};
    for (const bt of bestUploadTimes) {
      const key = `${bt.day}-${bt.hour}`;
      if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0 };
      aggregated[key].sum += bt.avgViews;
      aggregated[key].count += 1;
    }
    const heatmapData = Object.entries(aggregated).map(([key, val]) => {
      const [day, hourStr] = key.split("-");
      return { day, hour: parseInt(hourStr), avgViews: Math.round(val.sum / val.count) };
    });
    let bestTime = "";
    let bestAvg = 0;
    for (const hd of heatmapData) {
      if (hd.avgViews > bestAvg) { bestAvg = hd.avgViews; bestTime = `${hd.day} at ${hd.hour}:00`; }
    }

    res.json({
      totalViews,
      totalLikes,
      totalComments,
      subsGained,
      totalUploads,
      totalChannels: userChannels.length,
      queueCount: (await db.select({ id: videoQueue.id }).from(videoQueue).where(and(eq(videoQueue.userId, userId), eq(videoQueue.status, "pending")))).length,
      videosUploaded: totalUploads,
      copyrightIssues,
      viewsChange: `${viewsChange.startsWith("-") ? "" : "+"}${viewsChange}%`,
      likesChange: `${likesChange.startsWith("-") ? "" : "+"}${likesChange}%`,
      viewsTrend,
      trendingSources: trendingSources?.slice(0, 5) || [],
      trendingVideos,
      subscriberGrowth,
      bestUploadTimes: heatmapData,
      bestTime: bestTime ? `Best time: ${bestTime} (avg ${bestAvg.toLocaleString()} views)` : "Not enough data",
      totalUploadsAnalyzed: userVideos.length,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/channels", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));
    const userVideos = await db.select().from(videoQueue).where(and(eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")));
    const sourcesList = await db.select().from(sources).where(eq(sources.userId, userId));

    const userWorkspaces = await db.select().from(workspaces).where(eq(workspaces.userId, userId));
    const result = userChannels.map((ch: any) => {
      const chVideos = userVideos.filter((v: any) => v.targetChannelId === ch.id);
      const src = sourcesList.find((s: any) => s.id === ch.sourceId);
      const ws = userWorkspaces.find((w: any) => w.id === ch.workspaceId);
      return {
        id: ch.id,
        channelName: ch.channelName,
        channelHandle: ch.channelHandle,
        sourceHandle: src?.accountHandle || "",
        email: ws?.email || "",
        views: ch.totalViews || sumField(chVideos, "ytViews"),
        likes: ch.totalLikes || sumField(chVideos, "ytLikes"),
        comments: ch.totalComments || sumField(chVideos, "ytComments"),
        subs: ch.totalSubsGained || 0,
        uploads: chVideos.length,
        copyrightIssues: chVideos.filter((v: any) => v.copyrightStatus && v.copyrightStatus !== "clean").length,
      };
    });
    result.sort((a: any, b: any) => b.views - a.views);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/videos", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const channelId = req.query.channelId as string;
    const copyright = (req.query.copyright as string) || "all";
    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));

    let conditions: any[] = [eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")];
    if (channelId) conditions.push(eq(videoQueue.targetChannelId, channelId));
    if (copyright === "clean") conditions.push(eq(videoQueue.copyrightStatus, "clean"));
    else if (copyright === "issues") conditions.push(sql`${videoQueue.copyrightStatus} != 'clean'`);

    const list = await db.select().from(videoQueue).where(and(...conditions)).orderBy(desc(videoQueue.createdAt));
    const result = list.map((v: any) => {
      const ch = userChannels.find((c: any) => c.id === v.targetChannelId);
      const views = parseInt(v.ytViews) || 0;
      const srcViews = 0;
      const convRate = srcViews > 0 ? ((views / srcViews) * 100).toFixed(1) : "0";
      return {
        id: v.id,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        createdAt: v.createdAt,
        channelName: ch?.channelName || "Unknown",
        channelId: v.targetChannelId,
        sourceHandle: "",
        srcViews,
        ytViews: views,
        ytLikes: parseInt(v.ytLikes) || 0,
        ytComments: parseInt(v.ytComments) || 0,
        ytSubsGained: parseInt(v.ytSubsGained) || 0,
        conversionRate: convRate,
        healthScore: v.healthScore || 100,
        copyrightStatus: v.copyrightStatus || "clean",
        youtubeVideoId: v.youtubeVideoId,
      };
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/videos/csv", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!; if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const channelId = req.query.channelId as string;
    let conditions: any[] = [eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")];
    if (channelId) conditions.push(eq(videoQueue.targetChannelId, channelId));
    const list = await db.select().from(videoQueue).where(and(...conditions)).orderBy(desc(videoQueue.createdAt));
    const csvHeader = "Title,Views,Likes,Comments,Subs Gained,Copyright Status,Date,YouTube URL\n";
    const csvRows = list.map((v: any) => {
      const title = `"${(v.title || "").replace(/"/g, '""')}"`;
      return `${title},${v.ytViews || 0},${v.ytLikes || 0},${v.ytComments || 0},${v.ytSubsGained || 0},${v.copyrightStatus || "clean"},${v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ""},https://youtu.be/${v.youtubeVideoId || ""}`;
    }).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=analytics-videos.csv");
    res.send(csvHeader + csvRows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/sources", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const userSources = await db.select().from(sources).where(eq(sources.userId, userId));
    const userVideos = await db.select().from(videoQueue).where(and(eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")));

    const result = userSources.map((src: any) => {
      const srcVids = userVideos.filter((v: any) => v.sourceId === src.id);
      if (srcVids.length === 0) return null;
      const best = [...srcVids].sort((a: any, b: any) => (parseInt(b.ytViews) || 0) - (parseInt(a.ytViews) || 0))[0];
      return {
        handle: src.accountHandle || "unknown",
        platform: src.platform,
        videos: srcVids.length,
        srcViews: 0,
        ytViews: sumField(srcVids, "ytViews"),
        bestVideoTitle: best?.title || "",
        bestVideoViews: parseInt(best?.ytViews) || 0,
        bestVideoYoutubeId: best?.youtubeVideoId || "",
      };
    }).filter(Boolean);

    result.sort((a: any, b: any) => b.ytViews - a.ytViews);
    const ranked = result.map((r: any, i: number) => ({ rank: i + 1, ...r }));
    res.json(ranked);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/history", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const channelId = req.query.channelId as string;
    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));
    let conditions: any[] = [eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")];
    if (channelId) conditions.push(eq(videoQueue.targetChannelId, channelId));
    const list = await db.select().from(videoQueue).where(and(...conditions)).orderBy(desc(videoQueue.createdAt));

    const sourcesList = await db.select().from(sources).where(eq(sources.userId, userId));
    const result = list.map((v: any) => {
      const ch = userChannels.find((c: any) => c.id === v.targetChannelId);
      const src = sourcesList.find((s: any) => s.id === v.sourceId);
      return {
        id: v.id,
        title: v.title,
        channelName: ch?.channelName || "Unknown",
        sourceHandle: src?.accountHandle || "",
        sourcePlatform: v.sourcePlatform || "",
        ytViews: parseInt(v.ytViews) || 0,
        copyrightStatus: v.copyrightStatus || "clean",
        date: v.createdAt,
        youtubeVideoId: v.youtubeVideoId,
      };
    });
    res.json({ total: result.length, items: result });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/comments", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const filter = (req.query.filter as string) || "all";
    const channelId = req.query.channelId as string;
    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));

    let channelIds = userChannels.map((c: any) => c.id);
    if (channelId) channelIds = [channelId];

    let conditions: any[] = [];
    for (const cid of channelIds) conditions.push(eq(videoComments.channelId, cid));
    const commentCondition = conditions.length > 1 ? conditions.reduce((a: any, b: any) => sql`${a} OR ${b}`) : conditions[0];

    let dbCondition = commentCondition;
    if (filter === "unread") dbCondition = and(commentCondition, eq(videoComments.isRead, false));
    else if (filter === "read") dbCondition = and(commentCondition, eq(videoComments.isRead, true));

    const userVideos = await db.select({ id: videoQueue.id, title: videoQueue.title, youtubeVideoId: videoQueue.youtubeVideoId })
      .from(videoQueue).where(eq(videoQueue.userId, userId));

    const comments = await db.select().from(videoComments).where(dbCondition).orderBy(desc(videoComments.publishedAt));
    const result = comments.map((c: any) => {
      const vid = userVideos.find((v: any) => v.id === c.videoId);
      const ch = userChannels.find((ch: any) => ch.id === c.channelId);
      return {
        ...c,
        videoTitle: vid?.title || "Unknown",
        videoYoutubeId: vid?.youtubeVideoId || "",
        channelName: ch?.channelName || "Unknown",
      };
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/comments/:id/reply", async (req: AuthRequest, res) => {
  try {
    const commentId = req.params.id;
    const { replyText } = req.body;
    if (!replyText) return res.status(400).json({ error: "replyText is required" });

    const comment = await db.select().from(videoComments).where(eq(videoComments.id, commentId)).then(r => r[0]);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const ch = await db.select().from(channels).where(eq(channels.id, comment.channelId!)).then(r => r[0]);
    if (!ch) return res.status(404).json({ error: "Channel not found" });

    let tokens: any;
    try {
      tokens = await readJsonFromFilebase(`workspaces/${ch.workspaceId}/oauth-tokens-${ch.id}.json`);
    } catch {}
    if (!tokens?.access_token) return res.status(401).json({ error: "Channel not authorized" });

    const { google } = await import("googleapis");
    const { default: oAuth2 } = await import("google-auth-library");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: tokens.access_token });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    await youtube.comments.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          parentId: comment.youtubeCommentId!,
          textOriginal: replyText,
        },
      },
    });

    await db.update(videoComments).set({ replyText, repliedAt: new Date() }).where(eq(videoComments.id, commentId));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/comments/mark-read", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const userChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.userId, userId));
    const channelIds = userChannels.map((c: any) => c.id);
    for (const cid of channelIds) {
      await db.update(videoComments).set({ isRead: true }).where(eq(videoComments.channelId, cid));
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/copyright", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const channelId = req.query.channelId as string;
    const issuesOnly = req.query.issuesOnly === "true";

    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));
    const userVideos = await db.select().from(videoQueue).where(and(eq(videoQueue.userId, userId), eq(videoQueue.status, "uploaded")));

    let videos = userVideos;
    if (channelId) videos = videos.filter((v: any) => v.targetChannelId === channelId);
    if (issuesOnly) videos = videos.filter((v: any) => v.copyrightStatus && v.copyrightStatus !== "clean");

    const cleanCount = videos.filter((v: any) => !v.copyrightStatus || v.copyrightStatus === "clean").length;
    const claimedCount = videos.filter((v: any) => v.copyrightStatus === "claimed").length;
    const blockedCount = videos.filter((v: any) => v.copyrightStatus === "blocked").length;
    const restrictedCount = videos.filter((v: any) => v.copyrightStatus === "restricted").length;

    const result = videos.map((v: any) => {
      const ch = userChannels.find((c: any) => c.id === v.targetChannelId);
      return {
        id: v.id,
        title: v.title,
        channelName: ch?.channelName || "Unknown",
        copyrightStatus: v.copyrightStatus || "clean",
        restrictionCountries: v.restrictionCountries || "",
        date: v.createdAt,
        youtubeVideoId: v.youtubeVideoId,
      };
    });

    res.json({
      summary: { clean: cleanCount, claimed: claimedCount, blocked: blockedCount, restricted: restrictedCount },
      items: result,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/sync", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const userChannels = await db.select().from(channels).where(eq(channels.userId, userId));
    let synced = 0;
    for (const ch of userChannels) {
      if (ch.authStatus !== "authorized" || !ch.youtubeChannelId) continue;
      let tokens: any;
      try {
        tokens = await readJsonFromFilebase(`workspaces/${ch.workspaceId}/oauth-tokens-${ch.id}.json`);
      } catch {}
      if (!tokens?.access_token) continue;

      try {
        const channelStats = await fetchChannelStats(ch.youtubeChannelId, tokens.access_token);
        const chVideos = await db.select().from(videoQueue)
          .where(and(eq(videoQueue.targetChannelId, ch.id), eq(videoQueue.status, "uploaded")));

        for (const v of chVideos) {
          if (!v.youtubeVideoId) continue;
          try {
            const stats = await fetchVideoStats([v.youtubeVideoId], tokens.access_token);
            const vidStats = stats[v.youtubeVideoId];
            if (vidStats) {
              await db.update(videoQueue).set({
                ytViews: vidStats.views,
                ytLikes: vidStats.likes,
                ytComments: vidStats.comments,
              }).where(eq(videoQueue.id, v.id));
            }
            const copyright = await fetchVideoCopyrightStatus(v.youtubeVideoId, tokens.access_token);
            await db.update(videoQueue).set({
              copyrightStatus: copyright.copyrightStatus,
              restrictionCountries: copyright.restrictionCountries.join(","),
            }).where(eq(videoQueue.id, v.id));
          } catch {}
        }

        await db.update(channels).set({
          totalViews: channelStats.viewCount,
          totalSubsGained: channelStats.subscriberCount,
        }).where(eq(channels.id, ch.id));

        synced++;
      } catch {}
    }
    res.json({ success: true, channelsSynced: synced });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;