const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    
    // Get active GCP credential
    const [gcp] = await sql.unsafe(`SELECT id, name FROM gcp_credentials WHERE workspace_id = '${wsId}' AND (status = 'active' OR status IS NULL) LIMIT 1`);
    if (!gcp) { console.log('No active GCP found!'); return; }
    console.log(`Using GCP: ${gcp.name} (${gcp.id})`);

    // Get channels
    const channels = await sql.unsafe(`SELECT id, channel_name FROM channels WHERE workspace_id = '${wsId}'`);
    console.log(`\nChannels to assign: ${channels.length}`);

    // Assign GCP to each channel
    for (const ch of channels) {
      await sql.unsafe(`UPDATE channels SET gcp_credential_id = '${gcp.id}', auth_status = 'pending' WHERE id = '${ch.id}'`);
      console.log(`  ${ch.channel_name} → assigned to GCP (auth set to pending for re-auth)`);
    }

    // Update GCP channel count
    await sql.unsafe(`UPDATE gcp_credentials SET channel_count = ${channels.length} WHERE id = '${gcp.id}'`);
    console.log(`\nGCP channel count updated: ${channels.length}`);

    // Verify schedules exist
    for (const ch of channels) {
      const [sched] = await sql.unsafe(`SELECT id FROM scheduled_uploads WHERE channel_id = '${ch.id}'`);
      if (!sched) {
        await sql.unsafe(`INSERT INTO scheduled_uploads (id, user_id, channel_id, scheduled_at, upload_times, max_videos_per_day, cron_expression, timezone, active) VALUES (gen_random_uuid(), (SELECT user_id FROM channels WHERE id = '${ch.id}'), '${ch.id}', NOW(), '["06:10","18:10"]', '3', '0 6,18 * * *', 'UTC', true)`);
        console.log(`  Created schedule for ${ch.channel_name}`);
      } else {
        console.log(`  Schedule exists for ${ch.channel_name}`);
      }
    }

    console.log('\nDone! Channels assigned to GCP.');
    console.log('\nNEXT: Channels need OAuth re-authorization.');
    console.log('Go to Channels page → click "Auth" button on each channel.');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
