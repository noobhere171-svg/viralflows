import type { youtube_v3 } from "googleapis";
import { readFile, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";

const CATEGORY_MAP: Record<string, string> = {
  "Film & Animation": "1", "Autos & Vehicles": "2", "Music": "10",
  "Pets & Animals": "15", "Sports": "17", "Short Movies": "18",
  "Travel & Events": "19", "Gaming": "20", "Videoblogging": "21",
  "People & Blogs": "22", "Comedy": "23", "Entertainment": "24",
  "News & Politics": "25", "Howto & Style": "26", "Education": "27",
  "Science & Technology": "28", "Nonprofits & Activism": "29",
};

export function mapCategoryId(category: string | undefined | null): string {
  if (!category) return "22";
  if (/^\d+$/.test(category)) return category;
  return CATEGORY_MAP[category] || "22";
}

function getMimeType(filePath: string): string {
  const map: Record<string, string> = {
    ".mp4": "video/mp4", ".mov": "video/quicktime",
    ".avi": "video/x-msvideo", ".webm": "video/webm",
    ".mkv": "video/x-matroska", ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv", ".m4v": "video/mp4",
  };
  return map[extname(filePath).toLowerCase()] || "video/mp4";
}

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

export async function getOAuthUrl(clientId: string, redirectUri: string, state?: string): Promise<string> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, undefined, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

export async function getOAuthTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to get OAuth tokens - missing access or refresh token");
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
  };
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; expiry_date: number }> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token!,
    expiry_date: credentials.expiry_date || Date.now() + 3600000,
  };
}

async function getAuthClient(
  accessToken: string,
  refreshToken?: string,
  clientId?: string,
  clientSecret?: string
): Promise<youtube_v3.Youtube> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.youtube({ version: "v3", auth: oauth2Client });
}

export interface UploadOptions {
  videoPath: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "public" | "unlisted" | "private";
  madeForKids?: boolean;
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  onProgress?: (bytes: number) => void;
  durationSeconds?: number;
}

export async function uploadVideo(
  options: UploadOptions
): Promise<{ videoId: string; videoUrl: string }> {
  const youtube = await getAuthClient(
    options.accessToken,
    options.refreshToken,
    options.clientId,
    options.clientSecret
  );

  const fileSize = (await readFile(options.videoPath)).length;
  const mimeType = getMimeType(options.videoPath);

  let finalTitle = options.title;
  let finalDesc = options.description;
  if (options.durationSeconds && options.durationSeconds <= 60) {
    if (!finalTitle.includes("#Shorts")) {
      const suffix = " #Shorts";
      finalTitle = (finalTitle + suffix).slice(0, 100);
    }
    if (!finalDesc.includes("#Shorts")) {
      finalDesc = (finalDesc + "\n#Shorts").slice(0, 5000);
    }
  }

  const MAX_RETRIES = 3;
  let lastErr: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res: any = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: finalTitle.slice(0, 100),
            description: finalDesc.slice(0, 5000),
            tags: options.tags?.slice(0, 500),
            categoryId: options.categoryId || "22",
            defaultLanguage: "en",
          },
          status: {
            privacyStatus: options.privacyStatus || "public",
            selfDeclaredMadeForKids: options.madeForKids || false,
          },
        },
        media: {
          body: createReadStream(options.videoPath),
          mimeType,
        },
      });

      if (!res.data.id) throw new Error("YouTube API returned no video ID");
      return {
        videoId: res.data.id,
        videoUrl: `https://youtu.be/${res.data.id}`,
      };
    } catch (err: any) {
      lastErr = err;
      const isTransient = err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("aborted") ||
        err.message?.includes("EPIPE") ||
        err.code === 429 || err.code === 500 || err.code === 502 || err.code === 503;
      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.warn(`[YouTube] Upload attempt ${attempt} failed (${err.message}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error("Upload failed after all retries");
}

export async function uploadThumbnail(
  videoId: string,
  thumbnailPath: string,
  accessToken: string
): Promise<void> {
  const youtube = await getAuthClient(accessToken);
  await youtube.thumbnails.set({
    videoId,
    media: { body: createReadStream(thumbnailPath) },
  });
}

export async function getChannelInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}> {
  const youtube = await getAuthClient(accessToken);
  const res = await youtube.channels.list({
    part: ["snippet", "statistics"],
    mine: true,
  });

  const channel = res.data.items?.[0];
  if (!channel) throw new Error("No channel found");

  return {
    id: channel.id!,
    name: channel.snippet?.title || "Unknown",
    subscriberCount: parseInt(channel.statistics?.subscriberCount || "0"),
    videoCount: parseInt(channel.statistics?.videoCount || "0"),
    viewCount: parseInt(channel.statistics?.viewCount || "0"),
  };
}

export async function getQuotaUsage(accessToken: string): Promise<{ used: number; remaining: number }> {
  const youtube = await getAuthClient(accessToken);
  const res = await youtube.videos.list({
    part: ["snippet"],
    myRating: "like",
    maxResults: 1,
  });
  return { used: res.data.pageInfo?.totalResults ?? 1, remaining: 10000 - (res.data.pageInfo?.totalResults ?? 0) };
}

const ANALYTICS_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
];

export function getAnalyticsOAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const { google } = require("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, undefined, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ANALYTICS_SCOPES,
    prompt: "consent",
    state,
  });
}

export async function fetchVideoStats(
  videoIds: string[],
  accessToken: string
): Promise<Record<string, { views: number; likes: number; comments: number }>> {
  const youtube = await getAuthClient(accessToken);
  const result: Record<string, any> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));
  for (const chunk of chunks) {
    const res = await youtube.videos.list({ part: ["statistics"], id: chunk });
    for (const item of res.data.items || []) {
      result[item.id!] = {
        views: parseInt(item.statistics?.viewCount || "0"),
        likes: parseInt(item.statistics?.likeCount || "0"),
        comments: parseInt(item.statistics?.commentCount || "0"),
      };
    }
  }
  return result;
}

export async function fetchChannelStats(
  channelId: string,
  accessToken: string
): Promise<{ subscriberCount: number; viewCount: number; videoCount: number; hiddenSubs: boolean }> {
  const youtube = await getAuthClient(accessToken);
  const res = await youtube.channels.list({
    part: ["statistics"],
    id: [channelId],
  });
  const ch = res.data.items?.[0];
  if (!ch) throw new Error("Channel not found");
  return {
    subscriberCount: parseInt(ch.statistics?.subscriberCount || "0"),
    viewCount: parseInt(ch.statistics?.viewCount || "0"),
    videoCount: parseInt(ch.statistics?.videoCount || "0"),
    hiddenSubs: ch.statistics?.hiddenSubscriberCount || false,
  };
}

export async function fetchVideoComments(
  videoId: string,
  accessToken: string
): Promise<{ youtubeCommentId: string; authorName: string; commentText: string; publishedAt: string; likeCount: number }[]> {
  const youtube = await getAuthClient(accessToken);
  const comments: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await youtube.commentThreads.list({
      part: ["snippet", "replies"],
      videoId,
      maxResults: 100,
      pageToken,
    });
    for (const item of res.data.items || []) {
      const topLevel = item.snippet.topLevelComment.snippet;
      comments.push({
        youtubeCommentId: item.id,
        authorName: topLevel.authorDisplayName,
        commentText: topLevel.textDisplay,
        publishedAt: topLevel.publishedAt,
        likeCount: parseInt(topLevel.likeCount || "0"),
      });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return comments;
}

export async function fetchVideoCopyrightStatus(
  videoId: string,
  accessToken: string
): Promise<{ copyrightStatus: string; restrictionCountries: string[] }> {
  const youtube = await getAuthClient(accessToken);
  try {
    const res = await youtube.videos.list({
      part: ["contentDetails", "status"],
      id: [videoId],
    });
    const item = res.data.items?.[0];
    if (!item) return { copyrightStatus: "unknown", restrictionCountries: [] };
    const regionRestriction = (item.contentDetails as any)?.regionRestriction;
    const blocked = regionRestriction?.blocked || [];
    const allowed = regionRestriction?.allowed || [];
    const restrictionCountries = blocked.length > 0 ? blocked : allowed.length > 0 ? allowed : [];
    const status = (item.status as any)?.uploadStatus || "processed";
    const embeddable = (item.status as any)?.embeddable;
    let copyrightStatus = "clean";
    if (restrictionCountries.length > 0 && blocked.length > 0) copyrightStatus = "blocked";
    else if (restrictionCountries.length > 0) copyrightStatus = "restricted";
    else if (status === "rejected" || embeddable === false) copyrightStatus = "claimed";
    return { copyrightStatus, restrictionCountries };
  } catch {
    return { copyrightStatus: "unknown", restrictionCountries: [] };
  }
}

export async function fetchAnalyticsReport(
  channelId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  metrics: string[],
  dimensions?: string[]
): Promise<any[]> {
  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const analytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });
  const res = await analytics.reports.query({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: metrics.join(","),
    dimensions: dimensions?.join(","),
    sort: `${metrics[0]}`,
  });
  return (res.data as any)?.rows || [];
}
