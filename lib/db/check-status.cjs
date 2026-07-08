const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';

    console.log('=== CHANNELS ===');
    const channels = await sql.unsafe("SELECT id, channel_name, auth_status, youtube_channel_id, gcp_credential_id FROM channels WHERE workspace_id = '" + wsId + "'");
    for (const ch of channels) {
      console.log('  ' + ch.channel_name + ': auth=' + ch.auth_status + ', yt_id=' + (ch.youtube_channel_id || 'none') + ', gcp=' + (ch.gcp_credential_id ? 'YES' : 'NO'));
    }

    console.log('\n=== SCHEDULES ===');
    const schedules = await sql.unsafe("SELECT su.upload_times, su.max_videos_per_day, su.active, c.channel_name FROM scheduled_uploads su JOIN channels c ON su.channel_id = c.id WHERE c.workspace_id = '" + wsId + "'");
    for (const s of schedules) console.log('  ' + s.channel_name + ': times=' + s.upload_times + ', max=' + s.max_videos_per_day + '/day, active=' + s.active);

    console.log('\n=== QUEUE BY CHANNEL ===');
    const queue = await sql.unsafe("SELECT c.channel_name, vq.status, COUNT(*) as count FROM video_queue vq JOIN channels c ON vq.target_channel_id = c.id WHERE c.workspace_id = '" + wsId + "' GROUP BY c.channel_name, vq.status ORDER BY c.channel_name, vq.status");
    for (const q of queue) console.log('  ' + q.channel_name + ' / ' + q.status + ': ' + q.count);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
