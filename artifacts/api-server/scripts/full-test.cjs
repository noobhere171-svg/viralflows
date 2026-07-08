const BASE = "http://localhost:5000/api";

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) return { error: `HTTP ${r.status}` };
  return r.json();
}

async function main() {
  console.log("=== FULL SYSTEM TEST REPORT ===\n");

  // 1. Workspaces
  const workspaces = await get("/workspaces");
  console.log("1. WORKSPACES:", Array.isArray(workspaces) ? workspaces.length : "ERROR");
  if (Array.isArray(workspaces)) {
    for (const ws of workspaces) {
      console.log(`   - ${ws.id.slice(0,8)} | email=${ws.email} | name=${ws.name} | auth=${ws.authStatus} | oauth=${ws.oauthFilePath ? "YES" : "NO"}`);
    }
  }

  // 2. Channels
  const channels = await get("/channels");
  console.log("\n2. CHANNELS:", Array.isArray(channels) ? channels.length : "ERROR");
  if (Array.isArray(channels)) {
    for (const ch of channels) {
      const wsId = ch.workspaceId ? ch.workspaceId.slice(0,8) : "NONE";
      console.log(`   - ${ch.channelName} | auth=${ch.authStatus} | ws=${wsId} | gcp=${ch.gcpCredentialId ? "YES" : "NO"} | sourceId=${ch.sourceId ? "YES" : "NO"}`);
    }
  }

  // 3. Sources
  const sources = await get("/sources");
  console.log("\n3. SOURCES:", Array.isArray(sources) ? sources.length : "ERROR");
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const filter = s.contentFilter || {};
      console.log(`   - ${s.accountHandle || s.id.slice(0,8)} | status=${s.status} | linkedChannel=${s.linkedChannelId ? s.linkedChannelId.slice(0,8) : "NONE"} | autoRefill=${filter.autoRefillEnabled || false} | minQueue=${filter.minQueue || "?"} | refillAmt=${filter.refillAmount || "?"}`);
    }
  }

  // 4. Queue items
  const queue = await get("/queue");
  console.log("\n4. QUEUE:", Array.isArray(queue) ? queue.length : "ERROR");
  if (Array.isArray(queue)) {
    const byStatus = {};
    for (const q of queue) {
      byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    }
    console.log(`   Status breakdown: ${JSON.stringify(byStatus)}`);
    const uploaded = queue.filter(q => q.status === "uploaded");
    if (uploaded.length > 0) {
      console.log(`   Uploaded items with youtubeVideoId:`);
      for (const u of uploaded.slice(0, 5)) {
        console.log(`     - ${u.title?.slice(0,40)} | ytId=${u.youtubeVideoId || "EMPTY"} | channel=${u.targetChannelId?.slice(0,8) || "?"}`);
      }
    }
    const pending = queue.filter(q => q.status === "pending");
    if (pending.length > 0) {
      console.log(`   Pending items: ${pending.length}`);
      for (const p of pending.slice(0, 3)) {
        console.log(`     - ${p.title?.slice(0,40)} | source=${p.sourceId?.slice(0,8) || "?"} | channel=${p.targetChannelId?.slice(0,8) || "?"}`);
      }
    }
    const failed = queue.filter(q => q.status === "failed" || q.status === "dead_letter");
    if (failed.length > 0) {
      console.log(`   Failed/dead_letter: ${failed.length}`);
      for (const f of failed.slice(0, 3)) {
        console.log(`     - ${f.title?.slice(0,40)} | status=${f.status} | error=${(f.errorMessage || "?").slice(0,80)}`);
      }
    }
  }

  // 5. Schedules
  const schedules = await get("/schedule");
  console.log("\n5. SCHEDULES:", Array.isArray(schedules) ? schedules.length : "ERROR");
  if (Array.isArray(schedules)) {
    for (const s of schedules.slice(0, 5)) {
      console.log(`   - ch=${s.channelId?.slice(0,8)} | active=${s.active} | maxVid=${s.maxVideosPerDay} | lastRun=${s.lastRunAt || "never"}`);
    }
  }

  // 6. GCP credentials per workspace
  console.log("\n6. GCP CREDENTIALS:");
  if (Array.isArray(workspaces)) {
    for (const ws of workspaces) {
      const creds = await get(`/workspaces/${ws.id}/gcp-credentials`);
      if (Array.isArray(creds)) {
        console.log(`   ${ws.email}: ${creds.length} credential(s)`);
        for (const c of creds) {
          console.log(`     - ${c.name} | clientId=${(c.clientId || "?").slice(0,20)}... | oauthFile=${c.oauthFilePath || "?"}`);
        }
      }
    }
  }

  console.log("\n=== END OF REPORT ===");
}

main().catch(e => { console.error("TEST FAILED:", e.message); process.exit(1); });
