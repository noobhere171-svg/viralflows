const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    const channels = await sql.unsafe(`SELECT id, channel_name, auth_status, youtube_channel_id, gcp_credential_id FROM channels WHERE workspace_id = '${wsId}'`);
    
    for (const ch of channels) {
      console.log(`${ch.channel_name}: auth=${ch.auth_status}, yt=${ch.youtube_channel_id || 'none'}, gcp=${ch.gcp_credential_id ? 'assigned' : 'none'}`);
      
      // Check if OAuth tokens exist
      const tokenPath = `workspaces/${wsId}/oauth-tokens-${ch.id}.json`;
      console.log(`  Token path: ${tokenPath}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
