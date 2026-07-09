import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import fetch from "node-fetch";
import { fetchTikTokUserProfile, fetchTikTokUserVideos, fetchTikTokUserVideosViaYtDlp } from "../lib/tiktok.js";
import { generateSeo } from "../lib/llm.js";
import { withTikwmRateLimit } from "../../../../lib/rate-limiter.js";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq, sql } from "drizzle-orm";
import { getUserPlanFeatures, getSearchCount, incrementSearchCount } from "../../../../lib/plan-limits.js";

const router = Router();
router.use(requireAuth);

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const FETCH_TIMEOUT = 15000;

async function checkSearchLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const features = await getUserPlanFeatures(userId);
  const limit = features?.dailySearches;
  if (limit === undefined || limit === null || limit === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }
  // Reset search count if new day
  const [user] = await db.select({
    searchCount: users.searchCount,
    searchCountResetAt: users.searchCountResetAt,
  }).from(users).where(eq(users.id, userId));
  const today = new Date();
  const lastReset = user?.searchCountResetAt;
  let currentCount = user?.searchCount ?? 0;
  if (!lastReset || lastReset.getDate() !== today.getDate() || lastReset.getMonth() !== today.getMonth() || lastReset.getFullYear() !== today.getFullYear()) {
    currentCount = 0;
    await db.update(users).set({ searchCount: 0, searchCountResetAt: today }).where(eq(users.id, userId));
  }
  return { allowed: currentCount < limit, current: currentCount, limit };
}

function safeStr(v: any, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  try { return String(v); } catch { return fallback; }
}

async function tikwmFetch(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await withTikwmRateLimit(() =>
      fetch(url, {
        headers: { "User-Agent": DEFAULT_UA, "Accept": "application/json" },
        signal: controller.signal,
      })
    );
    if (!response.ok) throw new Error(`TikTok API HTTP ${response.status}`);
    const data = await response.json() as any;
    if (data.code !== 0) throw new Error(data.msg || "API error");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function formatVideo(v: any) {
  return {
    id: safeStr(v.video_id),
    title: safeStr(v.title, "Untitled"),
    author: safeStr(v.author?.unique_id || "unknown"),
    authorNickname: safeStr(v.author?.nickname || ""),
    avatar: safeStr(v.author?.avatar || ""),
    views: Number(v.play_count) || 0,
    likes: Number(v.digg_count) || 0,
    comments: Number(v.comment_count) || 0,
    shares: Number(v.share_count) || 0,
    duration: Number(v.duration) || 0,
    coverUrl: safeStr(v.cover || ""),
    playUrl: safeStr(v.play || ""),
    platform: "tiktok",
  };
}

router.get("/trending", async (_req: AuthRequest, res) => {
  try {
    const data = await tikwmFetch("https://www.tikwm.com/api/feed/list?region=US&count=20");
    const videos = (data.data || []).map(formatVideo);
    res.json(videos);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/search", async (req: AuthRequest, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "Search query required" });

    const limitCheck = await checkSearchLimit(req.userId!);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Daily search limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more searches.`,
        limitCheck,
      });
    }

    const data = await tikwmFetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=20`);
    const items = data.data?.videos || data.data || [];
    const videos = items.map(formatVideo);

    await incrementSearchCount(req.userId!);

    res.json(videos);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/user/:username", async (req: AuthRequest, res) => {
  try {
    const username = req.params.username;
    const [profile, videos] = await Promise.all([
      fetchTikTokUserProfile(username as string),
      fetchTikTokUserVideosViaYtDlp(username as string).catch(() => fetchTikTokUserVideos(username as string)),
    ]);
    res.json({ profile, videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      author: v.author,
      authorUrl: v.authorUrl,
      duration: v.duration,
      playUrl: v.playUrl,
      coverUrl: v.coverUrl,
      likeCount: v.likeCount,
      shareCount: v.shareCount,
      commentCount: v.commentCount,
      platform: "tiktok",
    })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate-seo", async (req: AuthRequest, res) => {
  try {
    const { title, platform } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const seo = await generateSeo(title, platform || "tiktok");
    res.json(seo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/creators", async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const searchType = (req.query.type as string) || "keyword";
    if (!q.trim()) return res.status(400).json({ error: "Search query required" });

    const limitCheck = await checkSearchLimit(req.userId!);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Daily search limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more searches.`,
        limitCheck,
      });
    }
    const count = Math.min(Number(req.query.count) || 40, 50);
    const minFollowers = Number(req.query.minFollowers) || 0;

    // For username search, fetch profile directly (fast, single API call)
    if (searchType === "username") {
      const p = await fetchTikTokUserProfile(q);
      const vids = await fetchTikTokUserVideosViaYtDlp(q).catch(() => fetchTikTokUserVideos(q));
      const creator = {
        username: p.username, nickname: p.nickname, avatar: p.avatar,
        followers: p.followers, following: p.following, likes: p.likes, videos: p.videos,
        bio: p.bio, engagementScore: p.videos > 0 ? Number(((p.followers + p.likes) / p.videos).toFixed(1)) : 0,
      };
      return res.json({ creators: [creator], total: vids.length, uniqueCreators: 1, searched: q });
    }

    // For keyword/hashtag: search videos, extract unique authors
    const region = ((req.query.region as string) || "").toUpperCase();
    // If region is a valid 2-letter code, use trending feed; otherwise use keyword search
    const validRegions = ["US","UK","PK","CN","KR","JP","BR","DE","FR","CA","AU"];
    const useRegion = region.length === 2 && validRegions.includes(region);
    let items: any[];
    if (useRegion) {
      const feedData = await tikwmFetch(`https://www.tikwm.com/api/feed/list?region=${region}&count=${count}`);
      items = feedData.data || [];
    } else {
      const searchData = await tikwmFetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=${count}`);
      items = searchData.data?.videos || searchData.data || [];
    }

    // Extract unique authors with their video stats
    const authorMap = new Map<string, { username: string; nickname: string; avatar: string; followers: number; following: number; likes: number; videos: number; bio: string; totalViews: number; totalLikes: number; videoCount: number }>();
    for (const v of items) {
      const a = v.author;
      if (!a?.unique_id) continue;
      if (!authorMap.has(a.unique_id)) {
        authorMap.set(a.unique_id, {
          username: a.unique_id, nickname: a.nickname || a.unique_id, avatar: a.avatar || "",
          followers: 0, following: 0, likes: 0, videos: 0, bio: a.signature || "",
          totalViews: 0, totalLikes: 0, videoCount: 0,
        });
      }
      const author = authorMap.get(a.unique_id)!;
      author.totalViews += Number(v.play_count) || 0;
      author.totalLikes += Number(v.digg_count) || 0;
      author.videoCount += 1;
    }

    let creators = Array.from(authorMap.values());

    // Fetch profiles in PARALLEL (up to 15, 5 at a time, no sequential delay)
    const toEnhance = creators.slice(0, 15);
    for (let i = 0; i < toEnhance.length; i += 5) {
      const batch = toEnhance.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(c => fetchTikTokUserProfile(c.username)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled" && r.value && (r.value.followers > 0 || r.value.likes > 0)) {
          const p = r.value;
          toEnhance[i + j].followers = p.followers;
          toEnhance[i + j].following = p.following;
          toEnhance[i + j].likes = p.likes;
          toEnhance[i + j].videos = p.videos;
          if (p.bio) toEnhance[i + j].bio = p.bio;
        }
      }
    }

    // Calculate engagement
    for (const c of creators) {
      (c as any).engagementScore = c.videos > 0 ? Number(((c.followers + c.likes) / Math.max(c.videos, 1)).toFixed(1)) : 0;
    }

    const filtered = minFollowers > 0 ? creators.filter(c => c.followers >= minFollowers) : creators;

    await incrementSearchCount(req.userId!);

    res.json({
      creators: filtered,
      total: items.length,
      uniqueCreators: authorMap.size,
      searched: q,
    });
  } catch (err: any) {
    console.error("[Discover/creators] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/creators/:username", async (req: AuthRequest, res) => {
  try {
    const profile = await fetchTikTokUserProfile(req.params.username as string);
    const videos = await fetchTikTokUserVideosViaYtDlp(req.params.username as string).catch(() => fetchTikTokUserVideos(req.params.username as string));
    const engagementScore = profile.videos > 0 ? Number(((profile.followers + profile.likes) / profile.videos).toFixed(1)) : 0;
    res.json({ profile: { ...profile, engagementScore }, videos: videos.slice(0, 12) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
