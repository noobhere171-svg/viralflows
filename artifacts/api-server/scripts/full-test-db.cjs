const postgres = require('postgres');

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { 
    connect_timeout: 30,
    idle_timeout: 10,
    max: 2
  });
  
  console.log("=== FULL SYSTEM TEST REPORT ===\n");

  // 1. Workspaces
  const workspaces = await sql`SELECT id, user_id, email, name, auth_status, oauth_file_path, created_at FROM workspaces ORDER BY created_at`;
  console.log(`1. WORKSPACES: ${workspaces.length}`);
  for (const ws of workspaces) {
    console.log(`   ${ws.id.slice(0,8)} | email=${ws.email} | name=${ws.name} | auth=${ws.auth_status} | oauth=${ws.oauth_file_path ? "YES" : "NO"}`);
  }

  // 2. Channels
  const channels = await sql`SELECT id, channel_name, auth_status, workspace_id, gcp_credential_id, source_id, videos_uploaded FROM channels ORDER BY created_at`;
  console.log(`\n2. CHANNELS: ${channels.length}`);
  for (const ch of channels) {
    console.log(`   ${ch.channel_name} | auth=${ch.auth_status} | ws=${ch.workspace_id?.slice(0,8)||"NONE"} | gcp=${ch.gcp_credential_id?"YES":"NO"} | src=${ch.source_id?"YES":"NO"} | uploaded=${ch.videos_uploaded||0}`);
  }

  // 3. Sources
  const sources = await sql`SELECT id, account_handle, status, linked_channel_id, content_filter, platform FROM sources ORDER BY created_at`;
  console.log(`\n3. SOURCES: ${sources.length}`);
  for (const s of sources) {
    const f = s.content_filter || {};
    console.log(`   ${s.account_handle||s.id.slice(0,8)} | status=${s.status} | linked=${s.linked_channel_id?.slice(0,8)||"NONE"} | autoRefill=${f.autoRefillEnabled||false} | minQ=${f.minQueue||"?"} | refill=${f.refillAmount||"?"} | sortBy=${f.sortBy||"?"} | minViews=${f.minViews||0}`);
  }

  // 4. Queue
  const queue = await sql`SELECT status, count(*) as cnt FROM video_queue GROUP BY status`;
  console.log(`\n4. QUEUE STATUS BREAKDOWN:`);
  for (const q of queue) {
    console.log(`   ${q.status}: ${q.cnt}`);
  }

  // Uploaded with youtubeVideoId
  const uploaded = await sql`SELECT title, youtube_video_id, target_channel_id, source_id FROM video_queue WHERE status = 'uploaded' ORDER BY created_at DESC LIMIT 10`;
  if (uploaded.length > 0) {
    console.log(`   Uploaded items (last 10):`);
    for (const u of uploaded) {
      console.log(`     "${(u.title||"?").slice(0,40)}" | ytId=${u.youtube_video_id||"EMPTY"} | ch=${u.target_channel_id?.slice(0,8)||"?"}`);
    }
  }

  // Failed
  const failed = await sql`SELECT title, status, error_message FROM video_queue WHERE status IN ('failed','dead_letter') ORDER BY created_at DESC LIMIT 5`;
  if (failed.length > 0) {
    console.log(`   Failed/dead_letter (last 5):`);
    for (const f of failed) {
      console.log(`     "${(f.title||"?").slice(0,40)}" | ${f.status} | ${(f.error_message||"?").slice(0,80)}`);
    }
  }

  // 5. Schedules
  const schedules = await sql`SELECT channel_id, active, max_videos_per_day, last_run_at, last_claimed_at FROM scheduled_uploads ORDER BY created_at`;
  console.log(`\n5. SCHEDULES: ${schedules.length}`);
  for (const s of schedules) {
    console.log(`   ch=${s.channel_id?.slice(0,8)} | active=${s.active} | maxVid=${s.max_videos_per_day} | lastRun=${s.last_run_at || "never"}`);
  }

  // 6. GCP Credentials
  const creds = await sql`SELECT workspace_id, name, client_id, oauth_file_path FROM gcp_credentials`;
  console.log(`\n6. GCP CREDENTIALS: ${creds.length}`);
  for (const c of creds) {
    console.log(`   ws=${c.workspace_id?.slice(0,8)} | name=${c.name} | clientId=${(c.client_id||"?").slice(0,25)}... | file=${c.oauth_file_path||"?"}`);
  }

  // 7. Operations (recent uploads)
  const ops = await sql`SELECT job_type, status, error_message, related_entity_id, created_at FROM operations WHERE job_type = 'scheduled_upload' ORDER BY created_at DESC LIMIT 10`;
  console.log(`\n7. RECENT OPERATIONS (scheduled_upload): ${ops.length}`);
  for (const o of ops) {
    console.log(`   ${o.status} | ${o.created_at} | ${o.error_message ? "err=" + o.error_message.slice(0,60) : "ok"}`);
  }

  console.log("\n=== END OF REPORT ===");
  await sql.end();
}

main().catch(e => { console.error("TEST FAILED:", e.message); process.exit(1); });
