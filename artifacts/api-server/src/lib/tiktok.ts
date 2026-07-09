import fetch from "node-fetch";
import https from "https";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PassThrough } from "stream";
import { writeFile, unlink, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import ytdl from "yt-dlp-exec";

export interface TikTokVideo {
  id: string;
  title: string;
  author: string;
  authorUrl: string;
  duration: number;
  playUrl: string;
  wmplayUrl: string;
  coverUrl: string;
  musicUrl: string;
  playCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
}

export interface TikTokOptions {
  proxyUrl?: string;
  userAgent?: string;
  cookiesPath?: string;
}

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 15000;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function makeTikwmAbsolute(url: string): string {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://www.tikwm.com${url.startsWith("/") ? "" : "/"}${url}`;
}

function getAgent(proxyUrl?: string): https.Agent | undefined {
  if (!proxyUrl) return undefined;
  if (proxyUrl.startsWith("socks")) return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

async function fetchWithTimeout(url: string, options: any = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveTikTokUrl(tiktokUrl: string): Promise<string> {
  const videoId = getTikTokVideoId(tiktokUrl);
  if (!videoId) {
    throw new Error(`Invalid TikTok URL: cannot extract numeric video ID from "${tiktokUrl}"`);
  }

  const sources: { name: string; resolve: () => Promise<string> }[] = [
    {
      name: "tikwm",
      resolve: async () => {
        const { withTikwmRateLimit: wrl } = await import("../../../../lib/rate-limiter.js");
        const apiUrl = "https://www.tikwm.com/api/";
        const response = await wrl(() =>
          fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent": DEFAULT_UA,
              "Accept": "application/json, text/plain, */*",
            },
            body: new URLSearchParams({ url: tiktokUrl, count: "12", cursor: "0", web: "1", hd: "1" }),
          })
        );
        if (!response.ok) throw new Error(`tikwm HTTP ${response.status}`);
        const data = (await response.json()) as any;
        if (data.code !== 0) throw new Error(`tikwm error: ${data.msg}`);
        const playUrl = makeTikwmAbsolute(data.data?.play || data.data?.wmplay || "");
        if (!playUrl) throw new Error("tikwm returned no play URL");
        return playUrl;
      },
    },
    {
      name: "cfworkers",
      resolve: async () => {
        const response = await fetchWithTimeout(
          `https://tdownv4.sl-bjs.workers.dev/?down=${encodeURIComponent(tiktokUrl)}`,
          { headers: { "User-Agent": DEFAULT_UA } },
        );
        if (!response.ok) throw new Error(`CF Workers HTTP ${response.status}`);
        const data = (await response.json()) as any;
        const dl = data.download_url || data.url || data.videoUrl;
        if (!dl) throw new Error("CF Workers returned no download URL");
        return dl;
      },
    },
    {
      name: "tikwm-direct",
      resolve: async () => {
        const { withTikwmRateLimit: wrl } = await import("../../../../lib/rate-limiter.js");
        const response = await wrl(() =>
          fetch("https://www.tikwm.com/api/", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent": DEFAULT_UA,
              "Accept": "application/json, text/plain, */*",
            },
            body: new URLSearchParams({ url: tiktokUrl, count: "1", cursor: "0", web: "1", hd: "1" }),
          })
        );
        if (!response.ok) throw new Error(`tikwm-direct HTTP ${response.status}`);
        const data = (await response.json()) as any;
        if (data.code !== 0) throw new Error(`tikwm-direct error: ${data.msg}`);
        const dl = makeTikwmAbsolute(data.data?.play || data.data?.wmplay || "");
        if (!dl) throw new Error("tikwm-direct returned no download URL");
        return dl;
      },
    },
  ];

  let lastErr: any;
  for (const source of sources) {
    try {
      const url = await source.resolve();
      console.log(`[TikTok] Resolved via ${source.name}: ${url.slice(0, 60)}...`);
      return url;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[TikTok] ${source.name} resolve failed: ${err.message}`);
      await sleep(2000);
    }
  }
  throw lastErr || new Error("All TikTok resolve sources failed");
}

export async function fetchTikTokVideo(url: string, options: TikTokOptions = {}): Promise<TikTokVideo> {
  const agent = getAgent(options.proxyUrl);
  const { withTikwmRateLimit: wrl } = await import("../../../../lib/rate-limiter.js");

  const apiUrl = "https://www.tikwm.com/api/";
  const response = await wrl(() =>
    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": options.userAgent || DEFAULT_UA,
        "Accept": "application/json, text/plain, */*",
      },
      body: new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" }),
      agent,
    })
  );

  if (!response.ok) {
    throw new Error(`tikwm.com API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;

  if (data.code !== 0) {
    throw new Error(`tikwm.com error: ${data.msg || "Unknown error"}`);
  }

  const info = data.data;

  return {
    id: info.id || randomUUID(),
    title: info.title || "Untitled TikTok",
    author: info.author?.nickname || info.unique_id || "Unknown",
    authorUrl: `https://www.tiktok.com/@${info.unique_id || "unknown"}`,
    duration: info.duration || 0,
    playUrl: makeTikwmAbsolute(info.play || info.wmplay || ""),
    wmplayUrl: makeTikwmAbsolute(info.wmplay || info.play || ""),
    coverUrl: info.cover || "",
    musicUrl: info.music || "",
    playCount: info.play_count || info.views || 0,
    likeCount: info.digg_count || 0,
    shareCount: info.share_count || 0,
    commentCount: info.comment_count || 0,
  };
}

async function downloadViaYtDlp(tiktokUrl: string, tmpPath: string, cookiesPath?: string): Promise<void> {
  const outDir = tmpdir();
  const outTemplate = tmpPath.replace(/\.mp4$/, "");
  const baseName = outTemplate.split(/[/\\]/).pop()!;
  console.log(`[TikTok] Downloading via yt-dlp: ${tiktokUrl.slice(0, 80)}...`);
  try {
    await (ytdl as any).exec(tiktokUrl, {
      noWarnings: true,
      noPlaylist: true,
      format: "best",
      output: join(outDir, `${baseName}.%(ext)s`),
      cookies: cookiesPath,
    });

    const { readdir } = await import("fs/promises");
    const files = await readdir(outDir);
    const match = files.find(f => f.startsWith(baseName));
    if (!match) throw new Error("yt-dlp completed but output file not found");

    const actualPath = join(outDir, match);
    const info = await stat(actualPath);
    if (info.size < 10000) {
      try { await unlink(actualPath); } catch {}
      throw new Error(`yt-dlp file too small (${info.size} bytes) — likely not a valid video`);
    }
    console.log(`[TikTok] yt-dlp download complete: ${Math.round(info.size / 1024)}KB (${match})`);

    if (actualPath !== tmpPath) {
      const { rename } = await import("fs/promises");
      await rename(actualPath, tmpPath);
    }
  } catch (err: any) {
    try {
      const { readdir } = await import("fs/promises");
      const files = await readdir(outDir);
      for (const f of files) {
        if (f.startsWith(baseName)) {
          try { await unlink(join(outDir, f)); } catch {}
        }
      }
    } catch {}
    throw new Error(`yt-dlp failed: ${err.stderr?.slice(0, 200) || err.message}`);
  }
}

async function downloadFromUrl(downloadUrl: string, tmpPath: string, agent: https.Agent | undefined): Promise<void> {
  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": DEFAULT_UA,
      "Referer": "https://www.tiktok.com/",
    },
    agent,
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const fileStream = createWriteStream(tmpPath);
  await new Promise<void>((resolve, reject) => {
    (response.body as any).pipe(fileStream);
    (response.body as any).on("error", reject);
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });
}

export async function downloadVideo(url: string, options: TikTokOptions = {}): Promise<string> {
  const agent = getAgent(options.proxyUrl);
  const tmpPath = join(tmpdir(), `vf-${randomUUID()}.mp4`);

  // Step 0: Try yt-dlp first (most reliable, handles TikTok challenges/cookies)
  try {
    await downloadViaYtDlp(url, tmpPath, options.cookiesPath);
    return tmpPath;
  } catch (err: any) {
    console.warn(`[TikTok] yt-dlp failed for ${url.slice(0, 60)}: ${err.message}`);
  }

  // Step 1: if it's a TikTok page URL, try resolve chain FIRST (before direct download)
  // This avoids 403 from expired CDN URLs
  const tikTokVideoId = getTikTokVideoId(url);
  if (tikTokVideoId) {
    try {
      const resolvedUrl = await resolveTikTokUrl(url);
      console.log(`[TikTok] Resolved URL via chain, downloading...`);
      await downloadFromUrl(resolvedUrl, tmpPath, agent);
      return tmpPath;
    } catch (resolveErr: any) {
      console.warn(`[TikTok] Resolve chain failed: ${resolveErr.message}`);
    }
  }

  // Step 2: try direct download with retries (handles 429/530/500/403)
  const MAX_RETRIES = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await downloadFromUrl(url, tmpPath, agent);
      return tmpPath;
    } catch (err: any) {
      lastErr = err;
      if (attempt >= MAX_RETRIES) break;
      const isRetryable = err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("530") ||
        err.message?.includes("429") ||
        err.message?.includes("403");
      if (isRetryable) {
        const delay = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
        console.warn(`[TikTok] Download attempt ${attempt} failed (${err.message}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  // Cleanup on complete failure
  try { await unlink(tmpPath); } catch {}
  throw lastErr || new Error("Download failed after all retries");
}

export async function cleanupVideo(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {}
}

async function fetchSinglePage(username: string, cursor: string, agent: any, ua: string): Promise<{ videos: TikTokVideo[]; cursor: string; hasMore: boolean }> {
  const url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`;
  const response = await fetch(url, {
    headers: { "User-Agent": ua, "Accept": "application/json, text/plain, */*" },
    agent,
  });
  if (!response.ok) throw new Error(`tikwm.com user API error: ${response.status}`);
  const data = (await response.json()) as any;
  if (data.code !== 0) throw new Error(`tikwm.com error: ${data.msg || "User not found"}`);

  const clean = username.replace(/^@/, "");
  const videos = (data.data?.videos || []).map((v: any) => ({
    id: v.video_id || randomUUID(),
    title: v.title || "Untitled TikTok",
    author: v.author?.nickname || v.unique_id || clean,
    authorUrl: `https://www.tiktok.com/@${v.unique_id || clean}`,
    duration: v.duration || 0,
    playUrl: v.play || v.wmplay || "",
    wmplayUrl: v.wmplay || v.play || "",
    coverUrl: v.cover || "",
    musicUrl: v.music || "",
    playCount: v.play_count || v.views || 0,
    likeCount: v.digg_count || 0,
    shareCount: v.share_count || 0,
    commentCount: v.comment_count || 0,
  }));

  return {
    videos,
    cursor: data.data?.cursor || "0",
    hasMore: data.data?.hasMore || false,
  };
}

export async function fetchTikTokUserVideos(username: string, options: TikTokOptions = {}): Promise<TikTokVideo[]> {
  const agent = getAgent(options.proxyUrl);
  const ua = options.userAgent || DEFAULT_UA;
  const cleanUsername = username.replace(/^@/, "");
  const maxPages = (options as any).maxPages || 5;

  const allVideos: TikTokVideo[] = [];
  let cursor = "0";
  let hasMore = true;
  let emptyPageCount = 0;

  while (hasMore && allVideos.length < maxPages * 35) {
    const page = await fetchSinglePage(cleanUsername, cursor, agent, ua);
    allVideos.push(...page.videos);
    cursor = page.cursor;
    hasMore = page.hasMore;

    if (page.videos.length === 0) {
      emptyPageCount++;
      if (emptyPageCount >= 2) break;
    } else {
      emptyPageCount = 0;
    }

    if (hasMore) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allVideos;
}

export async function fetchTikTokUserVideosViaYtDlp(username: string, cookiesPath?: string): Promise<TikTokVideo[]> {
  const cleanUsername = username.replace(/^@/, "");
  console.log(`[TikTok] Fetching user videos via yt-dlp: @${cleanUsername}`);
  const { stdout } = await (ytdl as any).exec(`https://www.tiktok.com/@${cleanUsername}`, {
    flatPlaylist: true,
    dumpJson: true,
    noWarnings: true,
    sleepInterval: 3,
    socketTimeout: 60,
    retries: 5,
    cookies: cookiesPath,
  });

  const lines = stdout.trim().split("\n").filter(Boolean);
  const videos: TikTokVideo[] = [];

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      videos.push({
        id: data.id || data.url?.match(/video\/(\d+)/)?.[1] || randomUUID(),
        title: data.title || data.description || "Untitled TikTok",
        author: data.uploader || data.creator || cleanUsername,
        authorUrl: `https://www.tiktok.com/@${cleanUsername}`,
        duration: data.duration || 0,
        playUrl: data.url || "",
        wmplayUrl: "",
        coverUrl: data.thumbnails?.[0]?.url || "",
        musicUrl: "",
        playCount: data.view_count || 0,
        likeCount: data.like_count || 0,
        shareCount: 0,
        commentCount: data.comment_count || 0,
      });
    } catch {}
  }

  console.log(`[TikTok] yt-dlp fetched ${videos.length} videos for @${cleanUsername}`);
  return videos;
}

export async function fetchTikTokVideoViaYtDlp(url: string, cookiesPath?: string): Promise<TikTokVideo> {
  console.log(`[TikTok] Fetching video info via yt-dlp: ${url.slice(0, 60)}...`);
  const data = await ytdl(url, {
    noWarnings: true,
    noPlaylist: true,
    socketTimeout: 60,
    retries: 5,
    cookies: cookiesPath,
  }) as any;

  const videoId = data.id || url.match(/video\/(\d+)/)?.[1] || randomUUID();
  const username = data.uploader_id || data.creator || data.channel || "unknown";

  return {
    id: videoId,
    title: data.title || data.description || "Untitled TikTok",
    author: data.uploader || username,
    authorUrl: `https://www.tiktok.com/@${username}`,
    duration: data.duration || 0,
    playUrl: data.url || "",
    wmplayUrl: "",
    coverUrl: data.thumbnails?.[0]?.url || "",
    musicUrl: data.track || "",
    playCount: data.view_count || 0,
    likeCount: data.like_count || 0,
    shareCount: 0,
    commentCount: data.comment_count || 0,
  };
}

export function isTikTokUsername(input: string): boolean {
  return /^@?[\w.\-]{2,24}$/.test(input) && !input.includes("tiktok.com") && !input.includes("/");
}

export interface TikTokUserProfile {
  username: string;
  nickname: string;
  avatar: string;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  bio: string;
}

export async function fetchTikTokUserProfile(username: string, options: TikTokOptions = {}): Promise<TikTokUserProfile> {
  const cleanUsername = username.replace(/^@/, "");
  const apiUrl = `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUsername)}`;
  const agent = getAgent(options.proxyUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": options.userAgent || DEFAULT_UA,
        "Accept": "application/json, text/plain, */*",
      },
      agent,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`tikwm.com user info error: ${response.status}`);
    const data = (await response.json()) as any;
    if (data.code !== 0) throw new Error(data.msg || "User not found");

    const u = data.data?.user || data.data || {};
    const s = data.data?.stats || u;
    return {
      username: u.unique_id || u.uniqueId || cleanUsername,
      nickname: u.nickname || cleanUsername,
      avatar: u.avatar || "",
      followers: Number(u.follower_count ?? u.followerCount ?? s.follower_count ?? 0),
      following: Number(u.following_count ?? u.followingCount ?? s.following_count ?? 0),
      likes: Number(u.heart_count ?? u.heartCount ?? u.total_favorites ?? s.heart_count ?? 0),
      videos: Number(u.video_count ?? u.videoCount ?? 0),
      bio: u.signature || u.bio || s.signature || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getTikTokVideoId(url: string): string | null {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/(\w+)/,
    /tiktok\.com\/t\/(\w+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
