const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const r = await sql.unsafe("SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'upload_method'");
    console.log(JSON.stringify(r, null, 2));
    
    // Also check which tables reference upload_method
    const r2 = await sql.unsafe("SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE '%upload%'");
    console.log("Upload-related columns:", JSON.stringify(r2, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
