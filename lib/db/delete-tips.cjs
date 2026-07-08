const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // Find Tips_mancing
    const [ch] = await sql.unsafe(`SELECT id, channel_name, workspace_id, user_id, gcp_credential_id FROM channels WHERE channel_name ILIKE '%tips%'`);
    if (!ch) { console.log('Tips_mancing not found'); return; }
    
    console.log(`Found: ${ch.channel_name} (id: ${ch.id})`);
    console.log(`  workspace: ${ch.workspace_id}`);
    console.log(`  user: ${ch.user_id}`);
    console.log(`  gcp: ${ch.gcp_credential_id}`);

    // Delete related records (order matters for FKs)
    await sql.unsafe(`DELETE FROM scheduled_uploads WHERE channel_id = '${ch.id}'`);
    console.log('  Deleted scheduled_uploads');
    
    // Delete video-related tables FIRST
    await sql.unsafe(`DELETE FROM video_comments WHERE channel_id = '${ch.id}'`);
    console.log('  Deleted video_comments');
    
    await sql.unsafe(`DELETE FROM copyright_claims WHERE channel_id = '${ch.id}'`);
    console.log('  Deleted copyright_claims');
    
    await sql.unsafe(`DELETE FROM analytics_daily WHERE channel_id = '${ch.id}'`);
    console.log('  Deleted analytics_daily');
    
    await sql.unsafe(`DELETE FROM analytics WHERE channel_id = '${ch.id}'`);
    console.log('  Deleted analytics');
    
    // Delete video_queue (has FK to sources)
    await sql.unsafe(`DELETE FROM video_queue WHERE target_channel_id = '${ch.id}'`);
    console.log('  Deleted video_queue items');
    
    // Then delete sources
    await sql.unsafe(`DELETE FROM sources WHERE linked_channel_id = '${ch.id}'`);
    console.log('  Deleted sources');
    
    await sql.unsafe(`DELETE FROM channels WHERE id = '${ch.id}'`);
    console.log('  Deleted channel');

    console.log('\nDone! Tips_mancing deleted successfully.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
