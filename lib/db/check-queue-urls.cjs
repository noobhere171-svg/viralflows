const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const items = await sql.unsafe("SELECT vq.id, vq.title, vq.source_url, vq.source_platform, c.channel_name FROM video_queue vq JOIN channels c ON vq.target_channel_id = c.id WHERE c.workspace_id = 'baea86ac-87cf-481c-ac6a-03e7eb24744a' AND vq.status = 'pending' LIMIT 5");
    for (const item of items) {
      console.log('Channel:', item.channel_name);
      console.log('Title:', item.title);
      console.log('URL:', item.source_url);
      console.log('Platform:', item.source_platform);
      console.log('---');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
