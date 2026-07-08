const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const channels = await sql.unsafe(`
      SELECT id, channel_name, auth_status, workspace_id, gcp_credential_id
      FROM channels 
      ORDER BY created_at DESC
    `);
    
    console.log(`Total channels in DB: ${channels.length}`);
    for (const ch of channels) {
      console.log(`  ${ch.channel_name}: auth=${ch.auth_status}, ws=${ch.workspace_id?.slice(0,8)}, gcp=${ch.gcp_credential_id?.slice(0,8) || 'none'}`);
    }

    const workspaces = await sql.unsafe(`SELECT id, email FROM workspaces`);
    console.log(`\nWorkspaces: ${workspaces.length}`);
    for (const ws of workspaces) {
      const chCount = await sql.unsafe(`SELECT COUNT(*) as count FROM channels WHERE workspace_id = '${ws.id}'`);
      console.log(`  ${ws.email || ws.id.slice(0,8)}: ${chCount[0].count} channels`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
