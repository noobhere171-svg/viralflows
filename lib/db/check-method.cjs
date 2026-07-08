const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // Check ALL columns in ALL tables for anything with 'method'
    const r = await sql.unsafe("SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE '%method%' AND table_name NOT LIKE 'pg_%'");
    console.log('All method columns:', JSON.stringify(r));

    // Check the drizzle schema for uploadMethod
    // Check video_queue table for anything like upload_method
    const vq = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'video_queue' AND column_name LIKE '%upload%'");
    console.log('video_queue upload cols:', JSON.stringify(vq));

    // Check if there's a migration that added this
    const allTables = await sql.unsafe("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public'");
    console.log('All tables:', JSON.stringify(allTables.map(t => t.table_name)));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
