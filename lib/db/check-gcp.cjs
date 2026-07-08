const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const r = await sql.unsafe("SELECT id, name, client_id, oauth_file_path, status, workspace_id, channel_count FROM gcp_credentials WHERE workspace_id = 'baea86ac-87cf-481c-ac6a-03e7eb24744a'");
    console.log(JSON.stringify(r, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
