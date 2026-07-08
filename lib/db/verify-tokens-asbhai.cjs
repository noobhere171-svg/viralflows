const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:\\Users\\Notta\\Desktop\\2nd\\viralflows\\artifacts\\api-server\\data';

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    const channels = await sql.unsafe(`SELECT id, channel_name, auth_status, youtube_channel_id, gcp_credential_id FROM channels WHERE workspace_id = '${wsId}'`);

    for (const ch of channels) {
      console.log(`\n=== ${ch.channel_name} ===`);
      
      // Read token
      const tokenPath = path.join(DATA_DIR, 'workspaces', wsId, `oauth-tokens-${ch.id}.json`);
      if (!fs.existsSync(tokenPath)) {
        console.log('  No token file! Need re-auth.');
        continue;
      }
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      console.log(`  Token exists, expires: ${new Date(tokens.expiry_date).toISOString()}`);
      console.log(`  Has refresh_token: ${!!tokens.refresh_token}`);
      
      // Try to call YouTube API to get channel info
      const resp = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const data = await resp.json();
      
      if (data.items && data.items.length > 0) {
        const ytChannel = data.items[0];
        console.log(`  YouTube Channel: ${ytChannel.snippet.title} (${ytChannel.id})`);
        
        // Update DB
        await sql.unsafe(`UPDATE channels SET youtube_channel_id = '${ytChannel.id}', channel_handle = '${ytChannel.snippet.title}', auth_status = 'authorized' WHERE id = '${ch.id}'`);
        console.log(`  ✅ Updated in DB: auth=authorized, yt=${ytChannel.id}`);
      } else {
        console.log(`  ❌ API Error: ${JSON.stringify(data.error || data)}`);
        if (data.error?.code === 401) {
          console.log('  Token expired. Need refresh or re-auth.');
        }
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
