const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:\\Users\\Notta\\Desktop\\2nd\\viralflows\\artifacts\\api-server\\data';

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + (data.expires_in * 1000),
  };
}

async function main() {
  try {
    const wsId = 'baea86ac-87cf-481c-ac6a-03e7eb24744a';
    
    // Read client_secret
    const csPath = path.join(DATA_DIR, 'workspaces', wsId, 'client_secret-1.json');
    const csData = JSON.parse(fs.readFileSync(csPath, 'utf-8'));
    const web = csData.web || csData.installed || csData;
    const clientId = web.client_id;
    const clientSecret = web.client_secret;
    console.log(`Client ID: ${clientId.slice(0,20)}...`);

    const channels = await sql.unsafe(`SELECT id, channel_name, auth_status FROM channels WHERE workspace_id = '${wsId}'`);

    for (const ch of channels) {
      console.log(`\n=== ${ch.channel_name} ===`);
      
      // Read token
      const tokenPath = path.join(DATA_DIR, 'workspaces', wsId, `oauth-tokens-${ch.id}.json`);
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      
      if (!tokens.refresh_token) {
        console.log('  No refresh_token! Must re-authorize.');
        continue;
      }

      try {
        // Refresh
        const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
        tokens.access_token = refreshed.access_token;
        tokens.expiry_date = refreshed.expiry_date;
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        console.log(`  Token refreshed! Expires: ${new Date(refreshed.expiry_date).toISOString()}`);

        // Now get channel info
        const resp = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const data = await resp.json();
        
        if (data.items && data.items.length > 0) {
          const ytChannel = data.items[0];
          console.log(`  YouTube Channel: ${ytChannel.snippet.title} (${ytChannel.id})`);
          
          await sql.unsafe(`UPDATE channels SET youtube_channel_id = '${ytChannel.id}', channel_handle = '${ytChannel.snippet.title}', auth_status = 'authorized' WHERE id = '${ch.id}'`);
          console.log(`  ✅ DB updated: auth=authorized`);
        } else {
          console.log(`  ❌ Still failing: ${JSON.stringify(data.error || data)}`);
        }
      } catch (err) {
        console.log(`  ❌ Refresh failed: ${err.message}`);
        console.log('  Need to re-authorize via browser.');
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
