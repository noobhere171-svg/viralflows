import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { workspaces } from "../../../../lib/db/src/schema/workspaces.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { gcpCredentials } from "../../../../lib/db/src/schema/gcp-credentials.js";
import { videoComments } from "../../../../lib/db/src/schema/video-comments.js";
import { copyrightClaims } from "../../../../lib/db/src/schema/copyright-claims.js";
import { analyticsDaily } from "../../../../lib/db/src/schema/analytics-daily.js";
import { analytics } from "../../../../lib/db/src/schema/analytics.js";
import { readJsonFromFilebase, writeJsonToFilebase, deleteFromFilebase, readTextFromFilebase, writeTextToFilebase, hasWorkspaceCookies, getWorkspaceCookiesPath } from "../lib/filebase.js";
import { getOAuthUrl, getOAuthTokens, getChannelInfo } from "../lib/youtube.js";
import { checkGcpProjectsLimit } from "../../../../lib/plan-limits.js";

const router = Router();

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ─── Public: OAuth callback (called by Google, no JWT) ───
router.get("/oauth/callback", async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=${encodeURIComponent(oauthError as string)}`);
    }
    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=missing_code_or_state`);
    }

    let workspaceId: string;
    let channelId: string | null = null;
    try {
      const decoded = Buffer.from(state as string, "base64").toString();
      const parts = decoded.split(":");
      workspaceId = parts[0];
      channelId = parts[1] || null;
    } catch {
      return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=invalid_state`);
    }

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!workspace) {
      return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=workspace_not_found`);
    }

    // Use channel's assigned GCP credential file path, fall back to workspace default
    let clientSecretPath = workspace.oauthFilePath || `workspaces/${workspaceId}/client_secret.json`;
    if (channelId) {
      const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
      if (ch?.gcpCredentialId) {
        const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, ch.gcpCredentialId));
        if (cred?.oauthFilePath) clientSecretPath = cred.oauthFilePath;
      }
    }
    const clientSecretData = await readJsonFromFilebase(clientSecretPath);
    const web = clientSecretData.web || clientSecretData.installed || clientSecretData;
    const clientId = web.client_id;
    const clientSecret = web.client_secret;
    if (!clientId || !clientSecret) {
      return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=invalid_client_secret`);
    }

    const redirectUri = `${BACKEND_URL}/api/workspaces/oauth/callback`;
    const tokens = await getOAuthTokens(clientId, clientSecret, redirectUri, code as string);

    // Verify which YouTube channel this token belongs to BEFORE saving
    let channelInfo: { id: string; name: string } | null = null;
    try {
      channelInfo = await getChannelInfo(tokens.access_token);
      console.log(`[OAuth callback] Token verified for YouTube channel: ${channelInfo.name} (${channelInfo.id})`);
    } catch (infoErr: any) {
      console.error(`[OAuth callback] Failed to verify channel info:`, infoErr.message);
    }

    // CONFLICT DETECTION: Check if another channel already has this YouTube channel ID
    if (channelInfo && channelId) {
      // Use raw query to find conflicts (any channel with this YouTube ID except the current one)
      const conflicts = await db.execute(sql`SELECT id, channel_name FROM channels WHERE youtube_channel_id = ${channelInfo.id} AND id != ${channelId} LIMIT 1`);
      const conflict = (conflicts as any[])?.[0];
      
      if (conflict) {
        console.error(`[OAuth callback] CONFLICT: YouTube channel "${channelInfo.name}" (${channelInfo.id}) already assigned to channel "${conflict.channel_name}" (${conflict.id}). Rejecting for channel ${channelId}.`);
        await db.update(channels).set({ authStatus: "error" }).where(eq(channels.id, channelId));
        const errorMsg = `wrong_account:${channelInfo.name}:${conflict.channel_name}`;
        return res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=${encodeURIComponent(errorMsg)}`);
      }
    }

    const tokenId = channelId ? `workspaces/${workspaceId}/oauth-tokens-${channelId}.json` : `workspaces/${workspaceId}/oauth-tokens.json`;
    await writeJsonToFilebase(tokenId, tokens);

    if (channelId) {
      // Save per-channel: youtubeChannelId + channelHandle from verified token
      const updateData: any = {
        authStatus: channelInfo ? "authorized" : "error",
      };
      if (channelInfo) {
        updateData.youtubeChannelId = channelInfo.id;
        updateData.channelHandle = channelInfo.name;
      }
      await db.update(channels).set(updateData).where(eq(channels.id, channelId));

      // Also update workspace authStatus
      await db.update(workspaces).set({
        authStatus: channelInfo ? "authorized" : "error",
        youtubeOAuthTokenId: tokenId,
      }).where(eq(workspaces.id, workspaceId));
    } else {
      // No channelId in state — authorize all channels in workspace
      // Each channel gets the same token but we verify and store per-channel
      const wsChannels = await db.select().from(channels).where(eq(channels.workspaceId, workspaceId));
      for (const ch of wsChannels) {
        const chTokenId = `workspaces/${workspaceId}/oauth-tokens-${ch.id}.json`;
        await writeJsonToFilebase(chTokenId, tokens);
        await db.update(channels).set({
          authStatus: channelInfo ? "authorized" : "error",
          ...(channelInfo ? { youtubeChannelId: channelInfo.id, channelHandle: channelInfo.name } : {}),
        }).where(eq(channels.id, ch.id));
      }
      await db.update(workspaces).set({
        authStatus: channelInfo ? "authorized" : "error",
        youtubeOAuthTokenId: tokenId,
      }).where(eq(workspaces.id, workspaceId));
    }

    const verifiedName = channelInfo ? channelInfo.name : "unknown";
    const verifiedId = channelInfo ? channelInfo.id : "unknown";
    const statusMsg = channelInfo
      ? `Authorization successful! YouTube channel: ${verifiedName} (${verifiedId}). You can close this window.`
      : `Authorization saved but channel verification failed. You may need to re-authorize.`;
    res.status(200).send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: "youtube-oauth-success", workspaceId: "${workspaceId}", channelId: "${channelId || ""}", verifiedChannel: ${JSON.stringify(channelInfo ? { id: channelInfo.id, name: channelInfo.name } : null)} }, "${FRONTEND_URL}");
      }
      setTimeout(function() { window.close(); }, 2000);
    </script><p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#333">${statusMsg}</p></body></html>`);
  } catch (err: any) {
    console.error("[OAuth callback error]", err);
    res.redirect(`${FRONTEND_URL}/workspaces?oauth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// ─── Auth middleware (all routes below require auth) ───
router.use(requireAuth);

// ─── Diagnostic endpoints (require auth) ───
router.get("/_diag", async (req: AuthRequest, res) => {
  try {
    const report: any = {};

    const ws = await db.select().from(workspaces);
    report.workspaces = ws.map(w => ({ id: w.id.slice(0,8), email: w.email, auth: w.authStatus, oauth: !!w.oauthFilePath }));

    const ch = await db.select().from(channels);
    report.channels = ch.map(c => ({ name: c.channelName, auth: c.authStatus, ws: c.workspaceId?.slice(0,8), gcp: !!c.gcpCredentialId, src: !!c.sourceId, uploaded: c.videosUploaded || 0 }));

    const src = await db.select().from(sources);
    report.sources = src.map(s => ({ handle: s.accountHandle || s.id.slice(0,8), status: s.status, linked: s.linkedChannelId?.slice(0,8) || "NONE", filter: s.contentFilter }));

    const qStatus = await db.select({ status: videoQueue.status, cnt: sql<number>`count(*)::int` }).from(videoQueue).groupBy(videoQueue.status);
    report.queueBreakdown = qStatus;

    const uploaded = await db.select({ title: videoQueue.title, ytId: videoQueue.youtubeVideoId, ch: videoQueue.targetChannelId }).from(videoQueue).where(eq(videoQueue.status, "uploaded"));
    report.uploadedItems = uploaded.map(u => ({ title: (u.title||"?").slice(0,40), ytId: u.ytId || "EMPTY", ch: u.ch?.slice(0,8) || "?" }));

    const failed = await db.select({ title: videoQueue.title, status: videoQueue.status, err: videoQueue.errorMessage }).from(videoQueue).where(inArray(videoQueue.status, ["failed","dead_letter"]));
    report.failedItems = failed.map(f => ({ title: (f.title||"?").slice(0,40), status: f.status, err: (f.err||"?").slice(0,80) }));

    const creds = await db.select().from(gcpCredentials);
    report.gcpCredentials = creds.map(c => ({ ws: c.workspaceId?.slice(0,8), name: c.name, clientId: (c.clientId||"?").slice(0,25), file: c.oauthFilePath }));

    const scheds = await db.select().from(scheduledUploads);
    report.schedules = scheds.map(s => ({ ch: s.channelId?.slice(0,8), active: s.active, maxVid: s.maxVideosPerDay, uploadTimes: s.uploadTimes, timezone: s.timezone, lastRun: s.lastRunAt || "never" }));

    res.json(report);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/_diag/reset-schedules", async (_req, res) => {
  try {
    await db.update(scheduledUploads)
      .set({ lastRunAt: null })
      .where(eq(scheduledUploads.active, true));
    res.json({ success: true, message: "All schedule lastRunAt cleared" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Verify which YouTube channel each token belongs to ───
router.get("/_diag/verify-tokens", async (_req, res) => {
  try {
    const allChannels = await db.select().from(channels);
    const results: any[] = [];

    for (const ch of allChannels) {
      const entry: any = {
        channelId: ch.id,
        channelName: ch.channelName,
        storedYoutubeChannelId: ch.youtubeChannelId || null,
        storedChannelHandle: ch.channelHandle || null,
        authStatus: ch.authStatus,
        workspaceId: ch.workspaceId?.slice(0, 8) || null,
      };

      // Try to load per-channel token file
      const tokenPath = ch.workspaceId
        ? `workspaces/${ch.workspaceId}/oauth-tokens-${ch.id}.json`
        : null;
      if (!tokenPath) {
        entry.verifyStatus = "NO_WORKSPACE";
        results.push(entry);
        continue;
      }

      let tokens: any;
      try {
        tokens = await readJsonFromFilebase(tokenPath);
      } catch {
        entry.verifyStatus = "NO_TOKEN_FILE";
        results.push(entry);
        continue;
      }

      if (!tokens?.access_token) {
        entry.verifyStatus = "NO_ACCESS_TOKEN";
        results.push(entry);
        continue;
      }

      // Call getChannelInfo to see which YouTube channel this token actually belongs to
      try {
        const info = await getChannelInfo(tokens.access_token);
        entry.verifiedYoutubeChannelId = info.id;
        entry.verifiedChannelName = info.name;
        entry.subscriberCount = info.subscriberCount;

        if (!ch.youtubeChannelId) {
          // No stored ID — first time, save it now
          await db.update(channels).set({
            youtubeChannelId: info.id,
            channelHandle: info.name,
          }).where(eq(channels.id, ch.id));
          entry.verifyStatus = "FIRST_TIME_SAVED";
        } else if (ch.youtubeChannelId === info.id) {
          entry.verifyStatus = "CORRECT";
        } else {
          entry.verifyStatus = "WRONG_ACCOUNT";
          entry.message = `Token belongs to "${info.name}" (${info.id}) but expected "${ch.channelHandle}" (${ch.youtubeChannelId})`;
        }
      } catch (infoErr: any) {
        if (infoErr.message?.includes("invalid_token") || infoErr.message?.includes("Token has been expired")) {
          entry.verifyStatus = "TOKEN_EXPIRED";
        } else {
          entry.verifyStatus = "VERIFY_FAILED";
          entry.error = infoErr.message;
        }
      }

      results.push(entry);
    }

    const summary = {
      total: results.length,
      correct: results.filter(r => r.verifyStatus === "CORRECT").length,
      wrongAccount: results.filter(r => r.verifyStatus === "WRONG_ACCOUNT").length,
      expired: results.filter(r => r.verifyStatus === "TOKEN_EXPIRED").length,
      noToken: results.filter(r => ["NO_TOKEN_FILE", "NO_ACCESS_TOKEN", "NO_WORKSPACE"].includes(r.verifyStatus)).length,
      firstTimeSaved: results.filter(r => r.verifyStatus === "FIRST_TIME_SAVED").length,
      failed: results.filter(r => ["VERIFY_FAILED", "UNKNOWN"].includes(r.verifyStatus)).length,
    };

    res.json({ summary, channels: results });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Test: trace exact upload path for a channel ───
router.get("/_diag/test-upload-trace/:channelId", async (req, res) => {
  try {
    const chId = req.params.channelId;
    const [channel] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const trace: any = { channelName: channel.channelName, steps: [] };

    // Step 1: Read token file
    const channelTokenPath = `workspaces/${channel.workspaceId}/oauth-tokens-${channel.id}.json`;
    let tokens: any;
    try {
      tokens = await readJsonFromFilebase(channelTokenPath);
      trace.steps.push({ step: "read_per_channel_token", path: channelTokenPath, hasAccessToken: !!tokens?.access_token, hasRefreshToken: !!tokens?.refresh_token, hasExpiryDate: !!tokens?.expiry_date, expiryDate: tokens?.expiry_date, now: Date.now(), isExpired: tokens?.expiry_date ? Date.now() > tokens.expiry_date : "no_expiry" });
    } catch (e: any) {
      trace.steps.push({ step: "read_per_channel_token", error: e.message });
    }

    // Step 2: Fallback to shared token
    if (!tokens?.access_token) {
      try {
        tokens = await readJsonFromFilebase(`workspaces/${channel.workspaceId}/oauth-tokens.json`);
        trace.steps.push({ step: "fallback_shared_token", hasAccessToken: !!tokens?.access_token, hasRefreshToken: !!tokens?.refresh_token });
      } catch (e: any) {
        trace.steps.push({ step: "fallback_shared_token", error: e.message });
      }
    }

    if (!tokens?.access_token) {
      trace.steps.push({ step: "ABORT", reason: "No access_token found" });
      return res.json(trace);
    }

    // Step 3: Read client_secret
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    try {
      let clientSecretPath: string | undefined;
      if (channel.gcpCredentialId) {
        const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
        if (cred?.oauthFilePath) clientSecretPath = cred.oauthFilePath;
        trace.steps.push({ step: "gcp_credential", credName: cred?.name, credPath: cred?.oauthFilePath });
      }
      if (!clientSecretPath) {
        clientSecretPath = `workspaces/${channel.workspaceId}/client_secret.json`;
      }
      const csData = await readJsonFromFilebase(clientSecretPath);
      const web = csData.web || csData.installed || csData;
      clientId = web.client_id;
      clientSecret = web.client_secret;
      trace.steps.push({ step: "client_secret", path: clientSecretPath, clientIdPrefix: clientId?.slice(0, 20), hasClientSecret: !!clientSecret });
    } catch (e: any) {
      trace.steps.push({ step: "client_secret_error", error: e.message });
    }

    // Step 4: Refresh token if expired
    if (tokens.expiry_date && Date.now() > tokens.expiry_date && clientId && clientSecret && tokens.refresh_token) {
      try {
        const { refreshAccessToken } = await import("../lib/youtube.js");
        const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
        trace.steps.push({ step: "token_refreshed", newExpiry: refreshed.expiry_date, tokenPrefix: refreshed.access_token?.slice(0, 20) });
        tokens.access_token = refreshed.access_token;
        tokens.expiry_date = refreshed.expiry_date;
      } catch (e: any) {
        trace.steps.push({ step: "token_refresh_FAILED", error: e.message });
      }
    } else {
      trace.steps.push({ step: "skip_refresh", reason: tokens.expiry_date ? "not_expired" : "no_expiry_date" });
    }

    // Step 5: Get channel info using EXACT same auth setup as upload
    try {
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const res2 = await youtube.channels.list({ part: ["snippet", "statistics"], mine: true });
      const ch = res2.data.items?.[0];
      trace.steps.push({ step: "getChannelInfo_with_client", youtubeChannelId: ch?.id, channelTitle: ch?.snippet?.title, subscribers: ch?.statistics?.subscriberCount });
    } catch (e: any) {
      trace.steps.push({ step: "getChannelInfo_with_client_FAILED", error: e.message });
    }

    // Step 6: Get channel info using getChannelInfo (no clientId) — compare
    try {
      const { getChannelInfo } = await import("../lib/youtube.js");
      const info = await getChannelInfo(tokens.access_token);
      trace.steps.push({ step: "getChannelInfo_no_client", youtubeChannelId: info.id, channelTitle: info.name });
    } catch (e: any) {
      trace.steps.push({ step: "getChannelInfo_no_client_FAILED", error: e.message });
    }

    res.json(trace);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Live test: create tiny MP4 and upload to verify YouTube API actually works ───
router.get("/_diag/live-test-upload/:channelId", async (req, res) => {
  try {
    const chId = req.params.channelId;
    const [channel] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const result: any = { channelName: channel.channelName, steps: [] };

    // Step 1: Create minimal valid MP4 file (1x1 black pixel, ~0.5s)
    const path = await import("path");
    const fs = await import("fs/promises");
    const os = await import("os");
    const testVideoPath = path.join(os.tmpdir(), `test-upload-${Date.now()}.mp4`);

    // Minimal valid MP4: ftyp + moov + mdat with a single black frame
    const mp4Buffer = Buffer.from([
      // ftyp box
      0x00,0x00,0x00,0x14,0x66,0x74,0x79,0x70,0x69,0x73,0x6F,0x6D,0x00,0x00,0x02,0x00,
      0x69,0x73,0x6F,0x6D,0x69,0x73,0x6F,0x32,
      // moov box (minimal)
      0x00,0x00,0x00,0x6C,0x6D,0x6F,0x6F,0x76,
      0x00,0x00,0x00,0x1C,0x6D,0x76,0x68,0x64,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      // tkhd
      0x00,0x00,0x00,0x20,0x74,0x6B,0x68,0x64,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x00,0x01,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      // mdia + mdhd
      0x00,0x00,0x00,0x20,0x6D,0x64,0x68,0x64,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      // minf + vmhd
      0x00,0x00,0x00,0x0C,0x76,0x6D,0x68,0x64,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,
    ]);

    await fs.writeFile(testVideoPath, mp4Buffer);
    const stat = await fs.stat(testVideoPath);
    result.steps.push({ step: "test_file_created", path: testVideoPath, size: stat.size });

    // Step 2: Load token + credentials (same as upload pipeline)
    const channelTokenPath = `workspaces/${channel.workspaceId}/oauth-tokens-${channel.id}.json`;
    let tokens: any;
    try {
      tokens = await readJsonFromFilebase(channelTokenPath);
    } catch {}
    if (!tokens?.access_token) {
      try { tokens = await readJsonFromFilebase(`workspaces/${channel.workspaceId}/oauth-tokens.json`); } catch {}
    }
    if (!tokens?.access_token) { result.steps.push({ step: "ABORT", reason: "no token" }); return res.json(result); }

    let clientId: string | undefined;
    let clientSecret: string | undefined;
    if (channel.gcpCredentialId) {
      const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
      if (cred?.oauthFilePath) {
        const csData = await readJsonFromFilebase(cred.oauthFilePath);
        const web = csData.web || csData.installed || csData;
        clientId = web.client_id;
        clientSecret = web.client_secret;
      }
    }

    result.steps.push({ step: "credentials_loaded", hasToken: !!tokens.access_token, hasClientId: !!clientId });

    // Step 3: Refresh if needed
    if (tokens.expiry_date && Date.now() > tokens.expiry_date && clientId && clientSecret && tokens.refresh_token) {
      try {
        const { refreshAccessToken } = await import("../lib/youtube.js");
        const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
        tokens.access_token = refreshed.access_token;
        tokens.expiry_date = refreshed.expiry_date;
        await writeJsonToFilebase(channelTokenPath, tokens).catch(() => {});
        result.steps.push({ step: "token_refreshed" });
      } catch (e: any) {
        result.steps.push({ step: "refresh_FAILED", error: e.message });
      }
    }

    // Step 4: ACTUAL YouTube upload with FULL response logging
    try {
      const { google } = await import("googleapis");
      const { createReadStream: crs } = await import("fs");
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      const uploadRes: any = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: `[TEST] ViralFlows Upload Test ${Date.now()}`.slice(0, 100),
            description: "Automated test upload from ViralFlows diagnostics. Will be deleted.",
            tags: ["test"],
            categoryId: "22",
            defaultLanguage: "en",
          },
          status: {
            privacyStatus: "unlisted",
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: crs(testVideoPath),
          mimeType: "video/mp4",
        },
      });

      result.steps.push({
        step: "upload_response",
        videoId: uploadRes.data.id,
        videoUrl: uploadRes.data.id ? `https://youtu.be/${uploadRes.data.id}` : null,
        kind: uploadRes.data.kind,
        status: uploadRes.data.status?.uploadStatus,
        privacyStatus: uploadRes.data.status?.privacyStatus,
        uploadStats: uploadRes.data.status?.failureReason || null,
        fullKeys: Object.keys(uploadRes.data || {}),
      });

      // Step 5: Immediately verify the video exists
      if (uploadRes.data.id) {
        try {
          const verifyRes: any = await youtube.videos.list({
            part: ["status", "snippet"],
            id: [uploadRes.data.id],
          });
          const vid = verifyRes.data.items?.[0];
          result.steps.push({
            step: "verify_video_exists",
            found: !!vid,
            title: vid?.snippet?.title,
            privacy: vid?.status?.privacyStatus,
            uploadStatus: vid?.status?.uploadStatus,
            failureReason: vid?.status?.failureReason,
            rejectionReason: vid?.status?.rejectionReason,
          });
        } catch (e: any) {
          result.steps.push({ step: "verify_FAILED", error: e.message });
        }
      }

      // Cleanup: delete test file
      try { await fs.unlink(testVideoPath); } catch {}
    } catch (e: any) {
      result.steps.push({ step: "upload_FAILED", error: e.message, code: e.code, status: e.status, details: e.errors?.map((x: any) => x.message) });
      try { await fs.unlink(testVideoPath); } catch {}
    }

    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── List actual YouTube videos on a channel ───
router.get("/_diag/list-youtube-videos/:channelId", async (req, res) => {
  try {
    const chId = req.params.channelId;
    const [channel] = await db.select().from(channels).where(eq(channels.id, chId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const channelTokenPath = `workspaces/${channel.workspaceId}/oauth-tokens-${channel.id}.json`;
    let tokens: any;
    try { tokens = await readJsonFromFilebase(channelTokenPath); } catch {}
    if (!tokens?.access_token) return res.status(400).json({ error: "No token" });

    let clientId: string | undefined;
    let clientSecret: string | undefined;
    if (channel.gcpCredentialId) {
      const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, channel.gcpCredentialId));
      if (cred?.oauthFilePath) {
        const csData = await readJsonFromFilebase(cred.oauthFilePath);
        const web = csData.web || csData.installed || csData;
        clientId = web.client_id;
        clientSecret = web.client_secret;
      }
    }

    if (tokens.expiry_date && Date.now() > tokens.expiry_date && clientId && clientSecret && tokens.refresh_token) {
      try {
        const { refreshAccessToken } = await import("../lib/youtube.js");
        const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
        tokens.access_token = refreshed.access_token;
        tokens.expiry_date = refreshed.expiry_date;
      } catch {}
    }

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    const yt = google.youtube({ version: "v3", auth: oauth2Client });

    // Get channel info
    const chRes = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
    const ytChannel = chRes.data.items?.[0];

    // Check specific video if requested
    const checkVideoId = req.query.videoId as string | undefined;
    if (checkVideoId) {
      const vidCheck = await yt.videos.list({ part: ["status", "processingDetails", "snippet"], id: [checkVideoId] });
      const vid = vidCheck.data.items?.[0];
      return res.json({
        channelName: channel.channelName,
        videoId: checkVideoId,
        found: !!vid,
        title: vid?.snippet?.title,
        uploadStatus: vid?.status?.uploadStatus,
        privacyStatus: vid?.status?.privacyStatus,
        processingStatus: vid?.processingDetails?.processingStatus,
        failureReason: vid?.status?.failureReason,
        rejectionReason: vid?.status?.rejectionReason,
      });
    }

    // List recent videos (use search.list for public, also check DB for uploaded ones)
    const vidRes = await yt.search.list({
      part: ["snippet"],
      channelId: ytChannel?.id!,
      order: "date",
      maxResults: 25,
      type: ["video"],
    });

    const searchVideos = (vidRes.data.items || []).map(item => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      publishedAt: item.snippet?.publishedAt,
      url: `https://youtu.be/${item.id?.videoId}`,
      source: "youtube",
    }));

    // Also check DB-uploaded videos via videos.list (may include private/unlisted)
    const dbUploaded = await db.select({ youtubeVideoId: videoQueue.youtubeVideoId, title: videoQueue.title })
      .from(videoQueue)
      .where(and(eq(videoQueue.targetChannelId, chId), eq(videoQueue.status, "uploaded")))
      .orderBy(videoQueue.createdAt);
    
    const dbVideoIds = dbUploaded.filter(v => v.youtubeVideoId && !searchVideos.some(sv => sv.id === v.youtubeVideoId)).map(v => v.youtubeVideoId!);
    
    let extraVideos: any[] = [];
    if (dbVideoIds.length > 0) {
      // Check in batches of 50
      for (let i = 0; i < dbVideoIds.length; i += 50) {
        const batch = dbVideoIds.slice(i, i + 50);
        const extraRes = await yt.videos.list({ part: ["status", "processingDetails", "snippet"], id: batch });
        for (const ev of extraRes.data.items || []) {
          extraVideos.push({
            id: ev.id,
            title: ev.snippet?.title,
            publishedAt: ev.snippet?.publishedAt,
            url: `https://youtu.be/${ev.id}`,
            uploadStatus: ev.status?.uploadStatus,
            privacyStatus: ev.status?.privacyStatus,
            processingStatus: ev.processingDetails?.processingStatus,
            source: "db-tracked",
          });
        }
      }
    }

    const allVideos = [...searchVideos, ...extraVideos];

    res.json({
      channelName: channel.channelName,
      youtubeChannelId: ytChannel?.id,
      youtubeTitle: ytChannel?.snippet?.title,
      totalVideos: ytChannel?.statistics?.videoCount,
      recentVideos: allVideos,
      count: allVideos.length,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Temporary: Trigger real upload for a channel (picks oldest pending item) ───
router.get("/_diag/trigger-upload/:channelId", async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    if (channel.authStatus !== "authorized") return res.status(400).json({ error: `Channel auth=${channel.authStatus}` });

    const items = await db.select().from(videoQueue)
      .where(and(eq(videoQueue.targetChannelId, channelId), eq(videoQueue.status, "pending")))
      .orderBy(videoQueue.createdAt);
    if (items.length === 0) return res.status(404).json({ error: "No pending items" });

    const item = items[0];
    const { runUploadPipeline } = await import("../../../../lib/upload-pipeline.js");
    const result = await runUploadPipeline({ queueItem: item, channel, context: "diag-trigger" });
    res.json({ success: result.success, videoId: result.youtubeVideoId, error: result.error ? String(result.error) : null, itemTitle: item.title });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Temporary: Reset uploaded items that were never actually uploaded ───
router.get("/_diag/reset-uploaded", async (_req, res) => {
  try {
    const count = await db.select({ cnt: sql<number>`count(*)::int` }).from(videoQueue).where(eq(videoQueue.status, "uploaded"));
    await db.update(videoQueue).set({ status: "pending", youtubeVideoId: null }).where(eq(videoQueue.status, "uploaded"));
    await db.update(channels).set({ videosUploaded: 0 });
    res.json({ success: true, resetCount: count[0]?.cnt || 0 });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Fix all sources: minViews=0, minQueue=5, refillAmount=5 ───
router.get("/_diag/fix-sources", async (_req, res) => {
  try {
    const allSources = await db.select().from(sources);
    let updated = 0;
    for (const src of allSources) {
      const filter = (src.contentFilter as any) || {};
      if (filter.autoRefillEnabled === false) continue;
      await db.update(sources).set({
        contentFilter: {
          ...filter,
          minViews: 0,
          minQueue: 5,
          refillAmount: 5,
          maxAge: 525600,
          sortBy: "oldest",
          autoRefillEnabled: true,
        },
      }).where(eq(sources.id, src.id));
      updated++;
    }
    res.json({ success: true, updatedSources: updated });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Temporary: Queue breakdown by channel ───
router.get("/_diag/queue-by-channel", async (_req, res) => {
  try {
    const chans = await db.select().from(channels);
    const result: any[] = [];
    for (const ch of chans) {
      const counts = await db.select({
        status: videoQueue.status,
        cnt: sql<number>`count(*)::int`,
      }).from(videoQueue).where(eq(videoQueue.targetChannelId, ch.id)).groupBy(videoQueue.status);
      const map: Record<string, number> = {};
      for (const c of counts) map[c.status ?? "unknown"] = c.cnt;
      result.push({ name: ch.channelName, authStatus: ch.authStatus, pending: map["pending"] || 0, uploaded: map["uploaded"] || 0, deadLetter: map["dead_letter"] || 0, failed: map["failed"] || 0 });
    }
    result.sort((a, b) => b.pending - a.pending);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(workspaces).where(eq(workspaces.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, gcpProjectId, gcpEmail } = req.body;
    const email = gcpEmail || "";
    // Dedup: reuse existing workspace for same user + email
    if (email) {
      const [existing] = await db.select().from(workspaces)
        .where(and(eq(workspaces.userId, req.userId!), eq(workspaces.email, email)))
        .limit(1);
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    const item = await db.insert(workspaces).values({ userId: req.userId!, name, gcpProjectId, email }).returning();
    res.status(201).json(item[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    if (ws.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    const wsChannels = await db.select().from(channels).where(eq(channels.workspaceId, wsId));

    for (const ch of wsChannels) {
      // Get all sources for this channel FIRST (before any deletion)
      const chSources = await db.select().from(sources).where(eq(sources.linkedChannelId, ch.id));

      // Null out sourceId FK on channels
      await db.update(channels).set({ sourceId: null }).where(eq(channels.id, ch.id));

      // Delete tables referencing videoQueue.id + channels.id (order matters for FKs)
      await db.delete(videoComments).where(eq(videoComments.channelId, ch.id));
      await db.delete(copyrightClaims).where(eq(copyrightClaims.channelId, ch.id));
      await db.delete(analyticsDaily).where(eq(analyticsDaily.channelId, ch.id));
      await db.delete(analytics).where(eq(analytics.channelId, ch.id));
      await db.delete(scheduledUploads).where(eq(scheduledUploads.channelId, ch.id));

      // Delete videoQueue items (FK to sources + channels)
      for (const src of chSources) {
        await db.delete(videoQueue).where(eq(videoQueue.sourceId, src.id));
      }
      await db.delete(videoQueue).where(eq(videoQueue.targetChannelId, ch.id));

      // Delete sources (FK to channels)
      await db.delete(sources).where(eq(sources.linkedChannelId, ch.id));
    }

    // Delete channels (FK to workspace + gcpCredentials)
    await db.delete(channels).where(eq(channels.workspaceId, wsId));
    // Delete gcpCredentials (FK to workspace)
    await db.delete(gcpCredentials).where(eq(gcpCredentials.workspaceId, wsId));
    // Delete workspace (all FK references gone)
    await db.delete(workspaces).where(eq(workspaces.id, wsId));
    try { await deleteFromFilebase(`workspaces/${wsId}/oauth-tokens.json`); } catch {}
    try { await deleteFromFilebase(`workspaces/${wsId}/client_secret.json`); } catch {}
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Delete workspace] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/oauth", async (req: AuthRequest, res) => {
  try {
    const clientSecretData = req.body;
    const web = clientSecretData.web || clientSecretData.installed || clientSecretData;
    if (!web.client_id || !web.client_secret) {
      return res.status(400).json({ error: "Invalid client_secret.json: missing client_id or client_secret" });
    }
    const key = `workspaces/${req.params.id}/client_secret.json`;
    await writeJsonToFilebase(key, clientSecretData);
    await db.update(workspaces).set({ oauthFilePath: key }).where(eq(workspaces.id, req.params.id as string));
    if (web.client_email) {
      await db.update(workspaces).set({ gcpEmail: web.client_email }).where(eq(workspaces.id, req.params.id as string));
    }
    // Also create gcp_credentials entry so it shows in unified OAuth Files list
    const [existing] = await db.select({ id: gcpCredentials.id }).from(gcpCredentials)
      .where(and(eq(gcpCredentials.workspaceId, req.params.id as string), eq(gcpCredentials.clientId, web.client_id)))
      .limit(1);
    if (!existing) {
      const credCount = (await db.select({ id: gcpCredentials.id }).from(gcpCredentials)
        .where(eq(gcpCredentials.workspaceId, req.params.id as string))).length;
      await db.insert(gcpCredentials).values({
        workspaceId: req.params.id as string,
        name: `Default`,
        clientId: web.client_id,
        clientEmail: web.client_email || "",
        oauthFilePath: key,
      });
    }
    res.json({ success: true, clientId: web.client_id, redirectUri: `${BACKEND_URL}/api/workspaces/oauth/callback` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/authorize", async (req: AuthRequest, res) => {
  try {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, req.params.id as string));
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    const clientSecretPath = workspace.oauthFilePath || `workspaces/${workspace.id}/client_secret.json`;
    const clientSecretData = await readJsonFromFilebase(clientSecretPath);
    const web = clientSecretData.web || clientSecretData.installed || clientSecretData;
    if (!web.client_id) return res.status(400).json({ error: "client_secret.json not uploaded. Upload it first." });
    const redirectUri = `${BACKEND_URL}/api/workspaces/oauth/callback`;
    const channelId = req.query.channelId as string | undefined;
    const state = Buffer.from(channelId ? `${workspace.id}:${channelId}` : workspace.id).toString("base64");
    const authUrl = await getOAuthUrl(web.client_id, redirectUri, state);
    res.json({ success: true, redirectUrl: authUrl, redirectUri });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auto-assign", async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const [ws] = await db.select().from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, req.userId!)));
    if (!ws) return res.status(404).json({ error: "Workspace not found" });

    const wsChannels = await db.select().from(channels).where(eq(channels.workspaceId, workspaceId));
    const allCreds = await db.select().from(gcpCredentials).where(eq(gcpCredentials.workspaceId, workspaceId));

    const creds = allCreds.filter(c => c.status === "active" || !c.status);
    const blockedCreds = allCreds.filter(c => c.status === "blocked" || c.status === "expired");

    if (creds.length === 0) {
      return res.status(400).json({
        error: "No active GCP credentials available",
        blocked: blockedCreds.length,
        message: "Upload a new GCP project or expire blocked ones first"
      });
    }

    const MAX_CHANNELS_PER_GCP = 3;

    const assignments: { channel: any; gcp: any }[] = [];
    const gcpChannelCounts: Record<string, number> = {};
    creds.forEach(c => { gcpChannelCounts[c.id] = 0; });

    for (const ch of wsChannels) {
      let bestGcp = null;
      let bestRemaining = -1;
      for (const cred of creds) {
        const remaining = MAX_CHANNELS_PER_GCP - (gcpChannelCounts[cred.id] || 0);
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestGcp = cred;
        }
      }
      if (bestGcp && bestRemaining > 0) {
        assignments.push({ channel: ch, gcp: bestGcp });
        gcpChannelCounts[bestGcp.id] = (gcpChannelCounts[bestGcp.id] || 0) + 1;
      }
    }

    let assignedCount = 0;
    for (const { channel: ch, gcp } of assignments) {
      await db.update(channels).set({
        gcpCredentialId: gcp.id,
      }).where(eq(channels.id, ch.id));

      const existing = await db.select({ id: scheduledUploads.id }).from(scheduledUploads)
        .where(eq(scheduledUploads.channelId, ch.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(scheduledUploads).values({
          userId: req.userId!,
          channelId: ch.id,
          scheduledAt: new Date(),
          uploadTimes: JSON.stringify(["12:00"]),
          cronExpression: "0 12 * * *",
          timezone: "UTC",
          active: true,
        }).returning();
      }
      assignedCount++;
    }

    for (const cred of creds) {
      await db.update(gcpCredentials)
        .set({ channelCount: gcpChannelCounts[cred.id] || 0 })
        .where(eq(gcpCredentials.id, cred.id));
    }

    const summary = creds.map(c => {
      const chCount = gcpChannelCounts[c.id] || 0;
      const perChannelLimit = chCount === 1 ? 3 : chCount === 2 ? 2 : 1;
      const gcpTotal = chCount * perChannelLimit;
      return {
        name: c.name,
        status: c.status || "active",
        channelsAssigned: chCount,
        maxChannels: MAX_CHANNELS_PER_GCP,
        perChannelLimit,
        gcpDailyTotal: gcpTotal,
      };
    });

    res.json({
      success: true,
      assigned: assignedCount,
      unassigned: wsChannels.length - assignedCount,
      activeGcps: creds.length,
      blockedGcps: blockedCreds.length,
      maxChannelsPerGcp: MAX_CHANNELS_PER_GCP,
      rule: "1ch=3/day, 2ch=2/day each, 3ch=1/day each",
      summary,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Temporary: merge duplicate workspaces by email ───
router.post("/merge-dups", async (req: AuthRequest, res) => {
  try {
    const all = await db.select().from(workspaces);
    const groups = new Map<string, typeof all>();
    for (const ws of all) {
      const key = `${ws.userId}|${ws.email || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ws);
    }
    let merged = 0;
    for (const [, list] of groups) {
      if (list.length <= 1) continue;
      const [keep, ...extras] = list.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
      for (const extra of extras) {
        const chs = await db.select({ id: channels.id }).from(channels)
          .where(eq(channels.workspaceId, extra.id));
        if (chs.length > 0) {
          await db.update(channels).set({ workspaceId: keep.id })
            .where(eq(channels.workspaceId, extra.id));
        }
        merged++;
      }
    }
    res.json({ merged, message: `${merged} duplicate workspaces resolved. Safe to delete via UI.` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/count", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(workspaces).where(eq(workspaces.userId, req.userId!));
    res.json({ count: list.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/delete-oauth-file", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const wsChannels = await db.select().from(channels).where(eq(channels.workspaceId, wsId));
    await deleteFromFilebase(`workspaces/${wsId}/client_secret.json`);
    await deleteFromFilebase(`workspaces/${wsId}/oauth-tokens.json`);
    for (const ch of wsChannels) {
      await deleteFromFilebase(`workspaces/${wsId}/oauth-tokens-${ch.id}.json`);
    }
    await db.update(workspaces).set({ oauthFilePath: null, youtubeOAuthTokenId: null, authStatus: "pending" }).where(eq(workspaces.id, wsId));
    await db.update(channels).set({ authStatus: "pending", youtubeChannelId: null, channelHandle: null }).where(eq(channels.workspaceId, wsId));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── GCP Credentials CRUD ───
router.get("/:id/gcp-credentials", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(gcpCredentials)
      .where(eq(gcpCredentials.workspaceId, req.params.id as string));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/gcp-credentials", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
    if (!ws) return res.status(404).json({ error: "Workspace not found" });

    // Plan enforcement: check GCP projects limit
    const gcpCheck = await checkGcpProjectsLimit(req.userId!);
    if (!gcpCheck.allowed) {
      return res.status(403).json({
        error: `GCP Projects limit reached (${gcpCheck.current}/${gcpCheck.limit}). Upgrade your plan to add more GCP projects.`,
        limitCheck: gcpCheck,
      });
    }

    const { name, clientSecretData } = req.body;
    if (!name || !clientSecretData) return res.status(400).json({ error: "name and clientSecretData required" });

    const web = clientSecretData.web || clientSecretData.installed || clientSecretData;
    if (!web.client_id || !web.client_secret) {
      return res.status(400).json({ error: "Invalid client_secret.json: missing client_id or client_secret" });
    }

    // Count existing credentials to generate unique name
    const existing = await db.select({ id: gcpCredentials.id }).from(gcpCredentials)
      .where(eq(gcpCredentials.workspaceId, wsId));
    const credIndex = existing.length + 1;

    const credName = name || `GCP Project ${credIndex}`;
    const filePath = `workspaces/${wsId}/client_secret-${credIndex}.json`;
    await writeJsonToFilebase(filePath, clientSecretData);

    const [cred] = await db.insert(gcpCredentials).values({
      workspaceId: wsId,
      name: credName,
      clientId: web.client_id,
      clientEmail: web.client_email || "",
      oauthFilePath: filePath,
    }).returning();

    // If workspace has no oauthFilePath yet, set it to this credential's file
    if (!ws.oauthFilePath) {
      await db.update(workspaces).set({ oauthFilePath: filePath }).where(eq(workspaces.id, wsId));
    }

    res.status(201).json(cred);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id/gcp-credentials/:credId", async (req: AuthRequest, res) => {
  try {
    const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, req.params.credId as string));
    if (cred) {
      await deleteFromFilebase(cred.oauthFilePath!);
      // Unlink channels using this credential
      await db.update(channels).set({ gcpCredentialId: null }).where(eq(channels.gcpCredentialId, cred.id));
      await db.delete(gcpCredentials).where(eq(gcpCredentials.id, cred.id));
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/oauth/status", async (req: AuthRequest, res) => {
  try {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, req.params.id as string));
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    res.json({ authorized: workspace.authStatus === "authorized", authStatus: workspace.authStatus, hasClientSecret: !!workspace.oauthFilePath });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/gcp-credentials", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const creds = await db.select().from(gcpCredentials).where(eq(gcpCredentials.workspaceId, wsId));
    res.json(creds);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/expire-gcp/:credId", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const credId = req.params.credId as string;

    const [cred] = await db.select().from(gcpCredentials).where(eq(gcpCredentials.id, credId));
    if (!cred || cred.workspaceId !== wsId) {
      return res.status(404).json({ error: "GCP credential not found" });
    }

    const affectedChannels = await db.select().from(channels)
      .where(eq(channels.gcpCredentialId, credId));

    for (const ch of affectedChannels) {
      await db.update(channels).set({
        authStatus: "expired",
        youtubeChannelId: null,
        channelHandle: null,
      }).where(eq(channels.id, ch.id));
    }

    await db.update(gcpCredentials)
      .set({ status: "expired", channelCount: 0, blockedAt: new Date() })
      .where(eq(gcpCredentials.id, credId));

    res.json({
      success: true,
      message: `GCP expired, ${affectedChannels.length} channels de-authorized`,
      affectedChannels: affectedChannels.map(ch => ch.channelName),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── TikTok Cookies ───

router.get("/:id/cookies", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
    if (!ws || ws.userId !== req.userId) return res.status(404).json({ error: "Workspace not found" });

    const exists = await hasWorkspaceCookies(wsId);
    res.json({ exists, message: exists ? "TikTok cookies found" : "No cookies uploaded yet" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/:id/cookies", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
    if (!ws || ws.userId !== req.userId) return res.status(404).json({ error: "Workspace not found" });

    const { cookies } = req.body;
    if (!cookies || typeof cookies !== "string") {
      return res.status(400).json({ error: "Provide cookies as a string (Netscape cookies.txt format)" });
    }

    if (!cookies.includes("# Netscape") && !cookies.includes("# HTTP Cookie File")) {
      return res.status(400).json({ error: "Invalid cookies format. Expected Netscape cookies.txt format." });
    }

    const key = `workspaces/${wsId}/cookies.txt`;
    await writeTextToFilebase(key, cookies);
    res.json({ success: true, message: "TikTok cookies uploaded successfully" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id/cookies", async (req: AuthRequest, res) => {
  try {
    const wsId = req.params.id as string;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
    if (!ws || ws.userId !== req.userId) return res.status(404).json({ error: "Workspace not found" });

    const key = `workspaces/${wsId}/cookies.txt`;
    await deleteFromFilebase(key);
    res.json({ success: true, message: "TikTok cookies deleted" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;