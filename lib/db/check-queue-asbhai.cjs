const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    
    // Queue breakdown per channel
    const channels = await sql.unsafe(`SELECT id, channel_name FROM channels WHERE workspace_id = '${wsId}'`);
    
    for (const ch of channels) {
      const queue = await sql.unsafe(`SELECT status, COUNT(*) as count FROM video_queue WHERE target_channel_id = '${ch.id}' GROUP BY status`);
      console.log(`\n${ch.channel_name} (${ch.id.slice(0,8)}):`);
      for (const q of queue) console.log(`  ${q.status}: ${q.count}`);
      
      // Show pending items
      const pending = await sql.unsafe(`SELECT id, title, source_url, source_platform FROM video_queue WHERE target_channel_id = '${ch.id}' AND status = 'pending' ORDER BY created_at LIMIT 5`);
      if (pending.length > 0) {
        console.log('  Pending items:');
        for (const p of pending) console.log(`    - ${(p.title || 'untitled').slice(0,50)} (${p.source_platform || 'unknown'})`);
      }
    }

    // Check sources
    const sources = await sql.unsafe(`SELECT id, account_handle, account_url, platform, status, linked_channel_id FROM sources WHERE workspace_id = '${wsId}'`);
    console.log(`\nSources (${sources.length}):`);
    for (const s of sources) {
      const chName = channels.find(c => c.id === s.linked_channel_id)?.channel_name || 'none';
      console.log(`  ${s.account_handle || s.account_url}: platform=${s.platform}, status=${s.status}, linked_to=${chName}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
