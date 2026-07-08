const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const src = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'sources' ORDER BY ordinal_position");
    console.log('sources columns:', JSON.stringify(src.map(r => r.column_name)));
    
    const sch = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'scheduled_uploads' ORDER BY ordinal_position");
    console.log('scheduled_uploads columns:', JSON.stringify(sch.map(r => r.column_name)));
    
    const vq = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'video_queue' ORDER BY ordinal_position");
    console.log('video_queue columns:', JSON.stringify(vq.map(r => r.column_name)));

    const all = await sql.unsafe("SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE '%method%' OR column_name LIKE '%upload_m%'");
    console.log('method/upload_m columns:', JSON.stringify(all));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
