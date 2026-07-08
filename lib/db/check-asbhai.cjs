const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // Find workspace
    const [ws] = await sql.unsafe(`SELECT * FROM workspaces WHERE email ILIKE '%asbhaihere%'`);
    if (!ws) { console.log('Workspace not found'); return; }
    console.log(`=== WORKSPACE: ${ws.email} (${ws.id}) ===`);

    // Channels
    const channels = await sql.unsafe(`SELECT id, channel_name, auth_status, gcp_credential_id, youtube_channel_id FROM channels WHERE workspace_id = '${ws.id}'`);
    console.log(`\nChannels (${channels.length}):`);
    for (const ch of channels) {
      console.log(`  ${ch.channel_name}: auth=${ch.auth_status}, gcp=${ch.gcp_credential_id || 'none'}, yt=${ch.youtube_channel_id || 'none'}`);
    }

    // GCP Credentials
    const gcps = await sql.unsafe(`SELECT id, name, status, channel_count, daily_upload_count FROM gcp_credentials WHERE workspace_id = '${ws.id}'`);
    console.log(`\nGCP Credentials (${gcps.length}):`);
    for (const g of gcps) {
      console.log(`  ${g.name}: status=${g.status || 'active'}, channels=${g.channel_count || 0}, today=${g.daily_upload_count || 0}`);
    }

    // Schedules
    for (const ch of channels) {
      const [sched] = await sql.unsafe(`SELECT * FROM scheduled_uploads WHERE channel_id = '${ch.id}'`);
      console.log(`\nSchedule for ${ch.channel_name}: ${sched ? `upload_times=${sched.upload_times}, max_per_day=${sched.max_videos_per_day}, active=${sched.active}` : 'NO SCHEDULE'}`);
    }

    // Queue
    const queue = await sql.unsafe(`SELECT status, COUNT(*) as count FROM video_queue WHERE target_channel_id IN (SELECT id FROM channels WHERE workspace_id = '${ws.id}') GROUP BY status`);
    console.log(`\nQueue:`);
    for (const q of queue) console.log(`  ${q.status}: ${q.count}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
