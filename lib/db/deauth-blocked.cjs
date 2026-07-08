const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // De-authorize channels on blocked/expired GCPs
    const result = await sql.unsafe(`
      UPDATE channels 
      SET auth_status = 'expired', youtube_channel_id = NULL, channel_handle = NULL
      WHERE gcp_credential_id IN (
        SELECT id FROM gcp_credentials WHERE status IN ('blocked', 'expired')
      )
      AND auth_status = 'authorized'
      RETURNING channel_name, gcp_credential_id
    `);

    console.log(`De-authorized ${result.length} channels on blocked GCPs:`);
    for (const ch of result) {
      console.log(`  - ${ch.channel_name} (GCP: ${ch.gcp_credential_id})`);
    }

    // Reset daily upload counts (fresh day)
    await sql.unsafe(`
      UPDATE gcp_credentials 
      SET daily_upload_count = 0, last_reset_at = NOW()
      WHERE status = 'active'
    `);
    console.log('\nReset daily upload counts for active GCPs');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
