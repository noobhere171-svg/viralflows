import { eq, and, sql } from "drizzle-orm";
import { db } from "./db/src/index.js";
import { videoQueue } from "./db/src/schema/video-queue.js";
import { channels } from "./db/src/schema/channels.js";
import { sources } from "./db/src/schema/sources.js";
import { gcpCredentials } from "./db/src/schema/gcp-credentials.js";

import { claimQueueItem, checkAndReclaimChannelLease } from "./queue-lock.js";
import { withYoutubeUploadRetry } from "./youtube-upload-retry.js";
import { getErrorMessage } from "./errors.js";
import { handleQueueItemFailure } from "./alerts.js";
import { createNotification } from "./notifications.js";

import { downloadVideo, cleanupVideo } from "../artifacts/api-server/src/lib/tiktok.js";
import { uploadVideo, mapCategoryId, refreshAccessToken } from "../artifacts/api-server/src/lib/youtube.js";
import { generateSeo } from "../artifacts/api-server/src/lib/llm.js";
import { readJsonFromFilebase, writeJsonToFilebase, hasWorkspaceCookies, getWorkspaceCookiesPath } from "../artifacts/api-server/src/lib/filebase.js";
import { triggerSourceRefill } from "../artifacts/api-server/src/workers/scheduler.js";
import { resolveGlobalProxyForUser, releaseGlobalProxy } from "./plan-limits.js";


export interface UploadPipelineParams {
  queueItem: typeof videoQueue.$inferSelect;
  channel: typeof channels.$inferSelect;
  context: string;
}

export interface UploadPipelineResult {
  success: boolean;
  youtubeVideoId?: string;
  error?: unknown;
  blocked?: boolean;
}

export async function runUploadPipeline({
  queueItem,
  channel,
  context,
}: UploadPipelineParams): Promise<UploadPipelineResult> {
  const lease = await checkAndReclaimChannelLease(db, videoQueue, channel.id);
  if (lease.blocked) {
    return { success: false, blocked: true, error: new Error(`Channel ${channel.channelName} already processing`) };
  }

  if (lease.reclaimedItemId) {
    console.log(`[UploadPipeline] Reclaimed stale lease on item ${lease.reclaimedItemId}`);
  }

  const claim = await claimQueueItem(db, videoQueue, queueItem.id);
  if (!claim.claimed) {
    return { success: false, blocked: true, error: new Error("Lost claim race") };
  }

  // Dynamic daily limit check: 1ch/GCP=3, 2ch/GCP=2, 3ch/GCP=1
  if (channel.gcpCredentialId) {
    const [chCountRow] = await db.select({ cnt: sql<number>`count(*)::int` })
      .from(channels).where(eq(channels.gcpCredentialId, channel.gcpCredentialId));
    const chCount = chCountRow?.cnt ?? 1;
    const maxPerDay = chCount <= 1 ? 3 : chCount === 2 ? 2 : 1;

    const [todayRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(videoQueue)
      .where(and(
        eq(videoQueue.targetChannelId, channel.id),
        eq(videoQueue.status, "uploaded"),
        sql`date_trunc('day', ${videoQueue.uploadedAt}) = date_trunc('day', NOW())`
      ));
    const todayCount = todayRow?.count ?? 0;

    if (todayCount >= maxPerDay) {
      return { success: false, blocked: true, error: new Error(`Daily limit reached: ${todayCount}/${maxPerDay} (${chCount} channel(s) on GCP)`) };
    }
  }

  let localPath: string | undefined;
  let proxyUrl: string | undefined;
  let proxyDbId: string | undefined;
  let proxyInfo: { proxyUrl: string; proxyId: string; useForUpload?: boolean; useForDownload?: boolean } | undefined;

  try {
    let item = queueItem;

    if (!item.description) {
      const seo = await generateSeo(item.title || "Untitled", item.sourcePlatform || "tiktok");
      await db
        .update(videoQueue)
        .set({ title: seo.title, description: seo.description, tags: seo.tags, category: seo.category })
        .where(eq(videoQueue.id, item.id));
      item = { ...item, ...seo };
    }

    let tokens: any;
    const channelTokenPath = `workspaces/${channel.workspaceId}/oauth-tokens-${channel.id}.json`;
    try {
      tokens = await readJsonFromFilebase(channelTokenPath);
    } catch {}
    if (!tokens?.access_token) {
      try {
        tokens = await readJsonFromFilebase(`workspaces/${channel.workspaceId}/oauth-tokens.json`);
      } catch {
        throw new Error(`No OAuth tokens for channel ${channel.channelName}`);
      }
    }
    if (!tokens?.access_token) {
      throw new Error(`access_token missing for channel ${channel.channelName}`);
    }

    // Pre-upload guard: verify channel has a verified YouTube channel ID
    if (!channel.youtubeChannelId) {
      await db.update(channels).set({ authStatus: "error" }).where(eq(channels.id, channel.id));
      await createNotification(channel.userId, "auth_error", `Channel ${channel.channelName} has no YouTube channel ID. Re-authorize.`, channel.id);
      throw new Error(`Channel ${channel.channelName} has no verified YouTube channel ID. Re-authorize with correct Google account.`);
    }

    // Pre-upload guard: verify GCP is not blocked/expired
    if (channel.gcpCredentialId) {
      const [gcpCred] = await db.select().from(gcpCredentials)
        .where(eq(gcpCredentials.id, channel.gcpCredentialId));
      if (gcpCred && (gcpCred.status === "blocked" || gcpCred.status === "expired")) {
        await db.update(channels).set({ authStatus: "expired" }).where(eq(channels.id, channel.id));
        await createNotification(channel.userId, "gcp_blocked", `GCP "${gcpCred.name}" is ${gcpCred.status}. Upload a new GCP project and re-authorize.`, channel.id);
        throw new Error(`GCP credential ${gcpCred.name} is ${gcpCred.status}. Upload a new GCP project and re-authorize.`);
      }
    }

    let clientId: string | undefined;
    let clientSecret: string | undefined;
    try {
      let clientSecretPath: string | undefined;
      if (channel.gcpCredentialId) {
        const [cred] = await db.select().from(gcpCredentials)
          .where(eq(gcpCredentials.id, channel.gcpCredentialId));
        if (cred?.oauthFilePath) clientSecretPath = cred.oauthFilePath;
      }
      if (!clientSecretPath) {
        clientSecretPath = `workspaces/${channel.workspaceId}/client_secret.json`;
      }
      const csData = await readJsonFromFilebase(clientSecretPath);
      const web = csData.web || csData.installed || csData;
      clientId = web.client_id;
      clientSecret = web.client_secret;
    } catch (credErr: any) {
      throw new Error(`client_secret failed: ${credErr.message}`);
    }
    if (!clientId || !clientSecret) {
      throw new Error("Missing client_id or client_secret");
    }

    // Resolve proxy for this user (used for download and/or upload)
    const resolvedProxy = await resolveGlobalProxyForUser(channel.userId);
    if (resolvedProxy) {
      proxyUrl = resolvedProxy.proxyUrl;
      proxyDbId = resolvedProxy.proxyId;
      proxyInfo = { proxyUrl: resolvedProxy.proxyUrl, proxyId: resolvedProxy.proxyId, useForUpload: resolvedProxy.useForUpload, useForDownload: resolvedProxy.useForDownload };
    }

    if (tokens.expiry_date && Date.now() > tokens.expiry_date) {
      const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token, proxyInfo?.useForUpload ? proxyUrl : undefined);
      tokens.access_token = refreshed.access_token;
      tokens.expiry_date = refreshed.expiry_date;
      await writeJsonToFilebase(channelTokenPath, tokens).catch(() => {});
    }

    // Token-to-channel verification: ensure this token uploads to the RIGHT YouTube channel
    try {
      // @ts-ignore
      const { google } = await import("googleapis");
      const authClient = new google.auth.OAuth2(clientId, clientSecret);
      authClient.setCredentials({ access_token: tokens.access_token });
      const yt = google.youtube({ version: "v3", auth: authClient });
      const chRes = await yt.channels.list({ part: ["id", "snippet"], mine: true });
      const actualChannelId = chRes.data.items?.[0]?.id;
      if (actualChannelId && actualChannelId !== channel.youtubeChannelId) {
        await db.update(channels).set({ authStatus: "error" }).where(eq(channels.id, channel.id));
        throw new Error(`Token mismatch: token belongs to YouTube channel ${actualChannelId} but channel ${channel.channelName} expects ${channel.youtubeChannelId}. Re-authorize with correct Google account.`);
      }
    } catch (verifyErr: any) {
      if (verifyErr.message?.includes("Token mismatch")) throw verifyErr;
      // If verify fails for other reasons (network), log warning but don't block
      console.warn(`[UploadPipeline] Token verification warning for ${channel.channelName}: ${verifyErr.message}`);
    }

    // Fix CDN URLs: if sourceUrl is a CDN link (expired), reconstruct from sourceVideoId
    let downloadUrl = item.sourceUrl!;
    if (downloadUrl.includes("tiktokcdn")) {
      if (item.sourceVideoId) {
        try {
          const [src] = await db.select().from(sources).where(eq(sources.id, item.sourceId!));
          if (src?.accountHandle) {
            downloadUrl = `https://www.tiktok.com/@${src.accountHandle}/video/${item.sourceVideoId}`;
            console.log(`[UploadPipeline] Reconstructed TikTok URL from CDN: ${downloadUrl.slice(0, 80)}`);
          }
        } catch {}
      }
      // If still a CDN URL (no sourceVideoId or no accountHandle), dead-letter — can't download expired CDN
      if (downloadUrl.includes("tiktokcdn")) {
        await db.update(videoQueue).set({
          status: "dead_letter",
          errorMessage: "Expired CDN URL with no sourceVideoId for reconstruction",
        }).where(eq(videoQueue.id, item.id));
        console.warn(`[UploadPipeline] Dead-lettering item ${item.id}: expired CDN URL, no sourceVideoId`);
        return { success: false, error: new Error("Expired CDN URL with no sourceVideoId") };
      }
    }

    // Resolve cookies path for yt-dlp
    let cookiesPath: string | undefined;
    if (channel.workspaceId && await hasWorkspaceCookies(channel.workspaceId)) {
      cookiesPath = getWorkspaceCookiesPath(channel.workspaceId);
      console.log(`[UploadPipeline] Using TikTok cookies for channel ${channel.channelName}`);
    }

    localPath = await downloadVideo(downloadUrl, {
      cookiesPath,
      proxyUrl: proxyInfo?.useForDownload ? proxyUrl : undefined,
    });

    if (proxyInfo?.useForUpload && proxyUrl) {
      console.log(`[Upload] Using proxy for upload: ${proxyUrl.replace(/:[^:]*@/, ':****@')}`);
    }

    const { videoId: youtubeVideoId } = await withYoutubeUploadRetry({
      context: `${context} channel=${channel.channelName} item=${item.id}`,
      attempt: () =>
        uploadVideo({
          videoPath: localPath!,
          title: item.title ?? "Untitled",
          description: item.description ?? "",
          tags: item.tags ?? undefined,
          categoryId: mapCategoryId(item.category),
          privacyStatus: "public",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId,
          clientSecret,
          proxyUrl: proxyInfo?.useForUpload ? proxyUrl : undefined,
        }),
    });

    // Post-upload verification: confirm the video actually exists AND is processing/published on YouTube
    // @ts-ignore
    const { google } = await import("googleapis");
    const verifyClient = new google.auth.OAuth2(clientId, clientSecret);
    verifyClient.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    if (proxyInfo?.useForUpload && proxyUrl) {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      const { Gaxios } = await import("gaxios");
      (verifyClient as any).transporter = new Gaxios({ agent: new HttpsProxyAgent(proxyUrl) });
    }
    const ytVerify = google.youtube({ version: "v3", auth: verifyClient });

    // Initial check: does the video exist at all?
    const verifyRes = await ytVerify.videos.list({ part: ["status", "processingDetails", "snippet"], id: [youtubeVideoId] });
    const verifiedVideo = verifyRes.data.items?.[0];

    if (!verifiedVideo) {
      throw new Error(`Post-upload verification failed: video ${youtubeVideoId} does not exist on YouTube. Upload may have been rejected.`);
    }

    // Check for immediate failures
    if (verifiedVideo.status?.uploadStatus === "failed") {
      throw new Error(`Upload failed: video ${youtubeVideoId} — ${verifiedVideo.status?.failureReason || "unknown reason"}`);
    }
    if (verifiedVideo.status?.rejectionReason) {
      throw new Error(`Upload rejected: video ${youtubeVideoId} — reason: ${verifiedVideo.status.rejectionReason}`);
    }

    // Check privacyStatus — must be public
    if (verifiedVideo.status?.privacyStatus !== "public") {
      console.warn(`[UploadPipeline] WARNING: video ${youtubeVideoId} privacyStatus="${verifiedVideo.status?.privacyStatus}" (expected "public"). GCP project may be unverified.`);
    }

    // Poll processing status until succeeded or failed (max 10 min = 20 attempts × 30s)
    let processingStatus = verifiedVideo.processingDetails?.processingStatus || "unknown";
    console.log(`[UploadPipeline] Video ${youtubeVideoId} processingStatus=${processingStatus}, uploadStatus=${verifiedVideo.status?.uploadStatus}`);

    let attempts = 0;
    const MAX_WAIT_MS = 3 * 60 * 1000; // 3 minutes
    const POLL_INTERVAL_MS = 15_000; // 15 seconds

    while (processingStatus === "processing" || processingStatus === "unknown" || processingStatus === "waiting") {
      if (attempts * POLL_INTERVAL_MS > MAX_WAIT_MS) {
        console.warn(`[UploadPipeline] Timed out waiting for video ${youtubeVideoId} to finish processing (status=${processingStatus}). Marking as uploaded anyway.`);
        break;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;

      const statusRes = await ytVerify.videos.list({ part: ["status", "processingDetails"], id: [youtubeVideoId] });
      const sv = statusRes.data.items?.[0];
      processingStatus = sv?.processingDetails?.processingStatus || "unknown";
      const uploadStatus = sv?.status?.uploadStatus || "unknown";

      console.log(`[UploadPipeline] Poll ${attempts}: video ${youtubeVideoId} processingStatus=${processingStatus} uploadStatus=${uploadStatus}`);

      if (uploadStatus === "failed") {
        throw new Error(`Video ${youtubeVideoId} processing failed: ${sv?.status?.failureReason || "unknown"}`);
      }
      if (sv?.status?.rejectionReason) {
        throw new Error(`Video ${youtubeVideoId} rejected: ${sv.status.rejectionReason}`);
      }
      if (processingStatus === "succeeded") break;
      if (processingStatus === "failed") {
        throw new Error(`Video ${youtubeVideoId} processingStatus=failed: ${sv?.processingDetails?.processingFailureReason || "unknown"}`);
      }
    }

    console.log(`[UploadPipeline] Post-upload verified: video ${youtubeVideoId} processingStatus=${processingStatus} uploadStatus=${verifiedVideo.status?.uploadStatus} privacy=${verifiedVideo.status?.privacyStatus}`);

    // Check for GCP blocked (unverified project → private + processing abandoned)
    if (verifiedVideo.status?.privacyStatus === "private" && processingStatus === "unknown") {
      console.error(`[UploadPipeline] GCP BLOCKED: video ${youtubeVideoId} is private with unknown processing. GCP project likely unverified.`);
      if (channel.gcpCredentialId) {
        await db.update(gcpCredentials)
          .set({ status: "blocked", blockedAt: new Date() })
          .where(eq(gcpCredentials.id, channel.gcpCredentialId));
        console.warn(`[UploadPipeline] GCP ${channel.gcpCredentialId} marked BLOCKED`);
        await db.update(channels)
          .set({ authStatus: "expired" })
          .where(eq(channels.id, channel.id));
        console.warn(`[UploadPipeline] Channel ${channel.channelName} de-authorized (GCP blocked)`);
        await createNotification(channel.userId, "gcp_blocked", `GCP project blocked! Video "${item.title}" locked as private. Re-authorize with a verified GCP project.`, channel.id);
      }
      throw new Error(`GCP project blocked: video locked to private. Re-authorize with a verified GCP project.`);
    }

    // Increment GCP daily upload count
    if (channel.gcpCredentialId) {
      await db.update(gcpCredentials)
        .set({ dailyUploadCount: sql`COALESCE(${gcpCredentials.dailyUploadCount}, 0) + 1` })
        .where(eq(gcpCredentials.id, channel.gcpCredentialId));
    }

    // Check if this video was already uploaded to this channel (duplicate key guard)
    const [existingUploaded] = await db.select({ id: videoQueue.id })
      .from(videoQueue)
      .where(and(
        eq(videoQueue.targetChannelId, channel.id),
        eq(videoQueue.sourceVideoId, item.sourceVideoId!),
        eq(videoQueue.status, "uploaded")
      ));

    if (existingUploaded && existingUploaded.id !== item.id) {
      // Same video already uploaded to this channel — mark this duplicate as cancelled
      await db.update(videoQueue)
        .set({ status: "cancelled", errorMessage: `Duplicate of uploaded item ${existingUploaded.id}` })
        .where(eq(videoQueue.id, item.id));
      console.log(`[UploadPipeline] (${context}) Duplicate: ${item.sourceVideoId} already uploaded as ${existingUploaded.id}. Cancelling ${item.id}`);
      return { success: true, youtubeVideoId: "duplicate-cancelled" };
    }

    await db
      .update(videoQueue)
      .set({ status: "uploaded", youtubeVideoId, uploadedAt: new Date() })
      .where(eq(videoQueue.id, item.id));

    await db
      .update(channels)
      .set({ videosUploaded: (channel.videosUploaded ?? 0) + 1 })
      .where(eq(channels.id, channel.id));

    console.log(`[UploadPipeline] (${context}) Uploaded "${item.title}" to ${channel.channelName}`);
    await createNotification(channel.userId, "upload_complete", `Video "${item.title}" uploaded to ${channel.channelName}.`, item.id);

    // Release proxy after upload is complete
    if (proxyDbId) {
      await releaseGlobalProxy(proxyDbId).catch(() => {});
    }

    // Trigger auto-refill for this channel's source after 30 seconds
    const sourceId = channel.sourceId;
    if (sourceId) {
      setTimeout(() => {
        triggerSourceRefill(sourceId).catch((err: any) => {
          console.warn(`[UploadPipeline] Trigger refill failed for source ${sourceId}: ${getErrorMessage(err)}`);
        });
      }, 30_000);
    }

    return { success: true, youtubeVideoId };
  } catch (err) {
    if (proxyDbId) {
      await releaseGlobalProxy(proxyDbId).catch(() => {});
    }
    await handleQueueItemFailure(db, videoQueue, queueItem.id, queueItem.retryCount ?? 0, err, context);
    console.error(`[UploadPipeline] (${context}) failed for ${queueItem.id}: ${getErrorMessage(err)}`);
    await createNotification(channel.userId, "upload_failed", `Upload failed for "${queueItem.title || "Untitled"}": ${getErrorMessage(err).slice(0, 200)}`, queueItem.id);
    return { success: false, error: err };
  } finally {
    if (localPath) {
      try {
        await cleanupVideo(localPath);
      } catch (cleanupErr) {
        console.error(`[UploadPipeline] cleanupVideo failed: ${getErrorMessage(cleanupErr)}`);
      }
    }
  }
}
