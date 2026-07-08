import db from "../../../../lib/db/src/index.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { workspaces } from "../../../../lib/db/src/schema/workspaces.js";
import { gcpCredentials } from "../../../../lib/db/src/schema/gcp-credentials.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { videoComments } from "../../../../lib/db/src/schema/video-comments.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { analyticsDaily } from "../../../../lib/db/src/schema/analytics-daily.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { readJsonFromFilebase, writeJsonToFilebase } from "../lib/filebase.js";
import { fetchVideoStats, fetchChannelStats, fetchVideoComments, fetchVideoCopyrightStatus } from "../lib/youtube.js";
import { createNotification } from "../../../../lib/notifications.js";

const SYNC_INTERVAL_MS = 1 * 60 * 60 * 1000;

async function syncChannelAnalytics(ch: any, tokens: any, googleAuth: any): Promise<void> {
  if (!ch.youtubeChannelId || ch.authStatus !== "authorized") return;

  const chVideos = await db.select()
    .from(videoQueue)
    .where(and(eq(videoQueue.targetChannelId, ch.id), eq(videoQueue.status, "uploaded")));

  const uploadedVideoIds = chVideos.filter((v: any) => v.youtubeVideoId).map((v: any) => v.youtubeVideoId!);

  if (uploadedVideoIds.length > 0) {
    let blockedCount = 0;

    if (googleAuth) {
      const { google } = await import("googleapis");
      const yt = google.youtube({ version: "v3", auth: googleAuth });
      for (const v of chVideos) {
        if (!v.youtubeVideoId) continue;

        try {
          const statusRes = await yt.videos.list({ part: ["status", "processingDetails"], id: [v.youtubeVideoId] });
        const ytVideo = statusRes.data.items?.[0];

        if (ytVideo) {
          const privacyStatus = ytVideo.status?.privacyStatus;
          const processingStatus = ytVideo.processingDetails?.processingStatus;
          const uploadStatus = ytVideo.status?.uploadStatus;

          // Detect blocked videos: private + unknown processing = GCP blocked
          if (privacyStatus === "private" && (processingStatus === "unknown" || !processingStatus)) {
            console.warn(`[AnalyticsSync] Video ${v.youtubeVideoId} is BLOCKED (private, processing=${processingStatus})`);
            await db.update(videoQueue).set({
              status: "blocked",
              processingStartedAt: new Date(),
            }).where(eq(videoQueue.id, v.id));
            blockedCount++;
            continue;
          }

          // Detect processing abandoned
          if (uploadStatus === "failed" || processingStatus === "failed") {
            console.warn(`[AnalyticsSync] Video ${v.youtubeVideoId} processing FAILED`);
            await db.update(videoQueue).set({
              status: "failed",
            }).where(eq(videoQueue.id, v.id));
            continue;
          }
        }
      } catch (err: any) {
        console.warn(`[AnalyticsSync] Could not verify video ${v.youtubeVideoId}: ${err.message}`);
      }
    }
    } // end if (googleAuth)

    if (blockedCount > 0) {
      console.warn(`[AnalyticsSync] Channel ${ch.channelName}: ${blockedCount} videos marked as BLOCKED`);
      if (blockedCount >= 2 && ch.gcpCredentialId) {
        await db.update(gcpCredentials)
          .set({ status: "blocked", blockedAt: new Date() })
          .where(eq(gcpCredentials.id, ch.gcpCredentialId));
        console.warn(`[AnalyticsSync] GCP ${ch.gcpCredentialId} marked BLOCKED (${blockedCount} blocked videos)`);
        await createNotification(ch.userId, "gcp_blocked", `GCP project blocked! ${blockedCount} videos on channel "${ch.channelName}" are locked as private.`, ch.id);

        if (ch.authStatus === "authorized") {
          await db.update(channels)
            .set({ authStatus: "expired", youtubeChannelId: null, channelHandle: null })
            .where(eq(channels.id, ch.id));
          console.warn(`[AnalyticsSync] Channel ${ch.channelName} de-authorized (GCP blocked) — other channels on same GCP unaffected`);
        }
      }
    }

    // Fetch stats for non-blocked videos
    const stats = await fetchVideoStats(uploadedVideoIds, tokens.access_token);
    for (const v of chVideos) {
      if (!v.youtubeVideoId || v.status === "blocked") continue;
      const vidStats = stats[v.youtubeVideoId];
      if (vidStats) {
        await db.update(videoQueue).set({
          ytViews: vidStats.views,
          ytLikes: vidStats.likes,
          ytComments: vidStats.comments,
        }).where(eq(videoQueue.id, v.id));
      }

      try {
        const copyright = await fetchVideoCopyrightStatus(v.youtubeVideoId, tokens.access_token);
        await db.update(videoQueue).set({
          copyrightStatus: copyright.copyrightStatus,
          restrictionCountries: copyright.restrictionCountries.join(","),
        }).where(eq(videoQueue.id, v.id));

        if (copyright.copyrightStatus !== "clean") {
          const existingClaim = await db.select()
            .from(copyrightClaims)
            .where(eq(copyrightClaims.videoId, v.id))
            .then(r => r[0]);
          if (!existingClaim) {
            await db.insert(copyrightClaims).values({
              channelId: ch.id,
              videoId: v.id,
              claimType: copyright.copyrightStatus,
              restrictionCountries: copyright.restrictionCountries.join(","),
              status: "active",
            });
            await createNotification(ch.userId, "copyright_claim", `Copyright claim on "${v.title || "Untitled"}" (${copyright.copyrightStatus}). Restrictions: ${copyright.restrictionCountries.join(", ") || "none"}`, v.id);
          }
        }
      } catch {}

      try {
        const comments = await fetchVideoComments(v.youtubeVideoId, tokens.access_token);
        for (const c of comments) {
          const existing = await db.select()
            .from(videoComments)
            .where(eq(videoComments.youtubeCommentId, c.youtubeCommentId))
            .then(r => r[0]);
          if (!existing) {
            await db.insert(videoComments).values({
              channelId: ch.id,
              videoId: v.id,
              youtubeCommentId: c.youtubeCommentId,
              authorName: c.authorName,
              commentText: c.commentText,
              publishedAt: new Date(c.publishedAt),
              likeCount: c.likeCount,
            });
          }
        }
      } catch {}
    }
  }

  try {
    const channelStats = await fetchChannelStats(ch.youtubeChannelId, tokens.access_token);
    await db.update(channels).set({
      totalViews: channelStats.viewCount,
      totalSubsGained: channelStats.subscriberCount,
    }).where(eq(channels.id, ch.id));

    const today = new Date().toISOString().split("T")[0];
    const existingDaily = await db.select()
      .from(analyticsDaily)
      .where(and(eq(analyticsDaily.channelId, ch.id), eq(analyticsDaily.date, today)))
      .then(r => r[0]);

    if (existingDaily) {
      await db.update(analyticsDaily).set({
        views: channelStats.viewCount,
        subsGained: channelStats.subscriberCount,
        videosPosted: channelStats.videoCount,
      }).where(eq(analyticsDaily.id, existingDaily.id));
    } else {
      await db.insert(analyticsDaily).values({
        channelId: ch.id,
        date: today,
        views: channelStats.viewCount,
        subsGained: channelStats.subscriberCount,
        videosPosted: channelStats.videoCount,
      });
    }
  } catch {}
}

async function processSync(): Promise<void> {
  console.log("[AnalyticsSync] Starting scheduled analytics sync...");
  try {
    const allChannels = await db.select().from(channels);
    let synced = 0;
    for (const ch of allChannels) {
      if (ch.authStatus !== "authorized") continue;
      try {
        const tokenPath = `workspaces/${ch.workspaceId}/oauth-tokens-${ch.id}.json`;
        const tokens = await readJsonFromFilebase(tokenPath);
        if (!tokens?.access_token) continue;

        let clientId: string | undefined;
        let clientSecret: string | undefined;
        try {
          let clientSecretPath: string | undefined;
          if (ch.gcpCredentialId) {
            const [cred] = await db.select().from(gcpCredentials)
              .where(eq(gcpCredentials.id, ch.gcpCredentialId));
            if (cred?.oauthFilePath) clientSecretPath = cred.oauthFilePath;
          }
          if (!clientSecretPath) {
            clientSecretPath = `workspaces/${ch.workspaceId}/client_secret.json`;
          }
          const csData = await readJsonFromFilebase(clientSecretPath);
          const web = csData.web || csData.installed || csData;
          clientId = web.client_id;
          clientSecret = web.client_secret;
        } catch {}
        if (clientId && clientSecret && tokens.expiry_date && Date.now() > tokens.expiry_date) {
          try {
            const { refreshAccessToken } = await import("../lib/youtube.js");
            const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
            tokens.access_token = refreshed.access_token;
            tokens.expiry_date = refreshed.expiry_date;
            await writeJsonToFilebase(tokenPath, tokens);
          } catch {
            await db.update(channels).set({ authStatus: "failed" }).where(eq(channels.id, ch.id));
            continue;
          }
        }

        // Create Google Auth client for video verification
        let googleAuthClient = null;
        if (clientId && clientSecret) {
          try {
            const { google } = await import("googleapis");
            const authClient = new google.auth.OAuth2(clientId, clientSecret);
            authClient.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
            googleAuthClient = authClient;
          } catch {}
        }

        await syncChannelAnalytics(ch, tokens, googleAuthClient);
        synced++;
      } catch (err: any) {
        console.error(`[AnalyticsSync] Failed for channel ${ch.id}: ${err.message}`);
        if (err.message?.includes("Invalid Credentials") || err.message?.includes("invalid_grant")) {
          await db.update(channels).set({ authStatus: "failed" }).where(eq(channels.id, ch.id));
          await createNotification(ch.userId, "auth_expiring", `Channel "${ch.channelName}" YouTube authorization failed. Re-authorize the channel.`, ch.id);
        }
      }
    }
    console.log(`[AnalyticsSync] Sync complete: ${synced} channels updated`);
  } catch (err: any) {
    console.error("[AnalyticsSync] Error:", err.message);
  }
}

export function startAnalyticsSync(): void {
  console.log("[AnalyticsSync] Starting background analytics sync (poll every 1 hour)");
  processSync().catch(err => console.error("[AnalyticsSync] Initial sync error:", err.message));
  setInterval(() => processSync().catch(err => console.error("[AnalyticsSync] Sync error:", err.message)), SYNC_INTERVAL_MS);
}
