const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    
    // Reset failed → pending for both channels
    const r1 = await sql.unsafe(`UPDATE video_queue SET status = 'pending', error_message = NULL, retry_count = 0 WHERE target_channel_id IN (SELECT id FROM channels WHERE workspace_id = '${wsId}') AND status = 'failed' RETURNING id`);
    console.log(`Reset ${r1.length} failed → pending`);

    // Reset dead_letter → pending
    const r2 = await sql.unsafe(`UPDATE video_queue SET status = 'pending', error_message = NULL, retry_count = 0 WHERE target_channel_id IN (SELECT id FROM channels WHERE workspace_id = '${wsId}') AND status = 'dead_letter' RETURNING id`);
    console.log(`Reset ${r2.length} dead_letter → pending`);

    // Verify schedules
    const schedules = await sql.unsafe(`SELECT su.id, su.channel_id, su.upload_times, su.max_videos_per_day, su.active, c.channel_name FROM scheduled_uploads su JOIN channels c ON su.channel_id = c.id WHERE c.workspace_id = '${wsId}'`);
    console.log(`\nSchedules:`);
    for (const s of schedules) {
      console.log(`  ${s.channel_name}: times=${s.upload_times}, max=${s.max_videos_per_day}, active=${s.active}`);
    }

    // Final queue count
    const queue = await sql.unsafe(`SELECT status, COUNT(*) as count FROM video_queue WHERE target_channel_id IN (SELECT id FROM channels WHERE workspace_id = '${wsId}') GROUP BY status`);
    console.log(`\nFinal queue:`);
    for (const q of queue) console.log(`  ${q.status}: ${q.count}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
