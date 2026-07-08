const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const r = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'channels' AND column_name LIKE '%oauth%'");
    console.log('channels oauth cols:', JSON.stringify(r));
    const w = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name LIKE '%oauth%'");
    console.log('workspaces oauth cols:', JSON.stringify(w));

    // Check if the error is actually on a DIFFERENT table - try all tables for upload_method
    const all = await sql.unsafe("SELECT table_name FROM information_schema.columns WHERE column_name = 'upload_method'");
    console.log('tables with upload_method:', JSON.stringify(all));

    // Also check the drizzle migrations
    const drizzleMeta = await sql.unsafe("SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5").catch(() => 'no migrations table');
    console.log('drizzle migrations:', JSON.stringify(drizzleMeta));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
