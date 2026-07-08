const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // Get workspace with most channels
    const [topWs] = await sql.unsafe(`
      SELECT workspace_id, COUNT(*) as ch_count 
      FROM channels 
      GROUP BY workspace_id 
      ORDER BY ch_count DESC 
      LIMIT 1
    `);
    
    if (!topWs) {
      console.log('No workspace found');
      return;
    }

    const wsId = topWs.workspace_id;
    console.log(`\n=== WORKSPACE: ${wsId} ===`);
    console.log(`Current channels: ${topWs.ch_count}\n`);

    // Get all channels in this workspace
    const channels = await sql.unsafe(`
      SELECT id, channel_name, auth_status, gcp_credential_id
      FROM channels 
      WHERE workspace_id = '${wsId}'
      ORDER BY created_at
    `);

    console.log('=== CURRENT CHANNELS ===');
    for (const ch of channels) {
      console.log(`  ${ch.channel_name}: auth=${ch.auth_status}, gcp=${ch.gcp_credential_id || 'none'}`);
    }

    // Get all GCP credentials in this workspace
    const gcps = await sql.unsafe(`
      SELECT id, name, status, channel_count
      FROM gcp_credentials 
      WHERE workspace_id = '${wsId}'
      ORDER BY created_at
    `);

    console.log('\n=== CURRENT GCPs ===');
    for (const g of gcps) {
      console.log(`  ${g.name}: status=${g.status || 'active'}, channels=${g.channel_count || 0}`);
    }

    // Simulate auto-assign with 10 channels and 4 GCPs
    const channelsPerProject = 2;
    const videosPerDay = 3;

    // Only use active GCPs
    const activeGcps = gcps.filter(g => g.status === 'active' || !g.status);
    const blockedGcps = gcps.filter(g => g.status === 'blocked' || g.status === 'expired');

    console.log(`\n=== AUTO-ASSIGN SIMULATION ===`);
    console.log(`Channels: ${channels.length}`);
    console.log(`Active GCPs: ${activeGcps.length}`);
    console.log(`Blocked GCPs: ${blockedGcps.length}`);
    console.log(`Channels per GCP: ${channelsPerProject}`);
    console.log(`Videos per day: ${videosPerDay}`);

    if (activeGcps.length === 0) {
      console.log('\n❌ No active GCPs available!');
      console.log('Upload new GCP projects first.');
      return;
    }

    // Calculate assignments
    const maxCapacity = activeGcps.length * channelsPerProject;
    const canAssignAll = channels.length <= maxCapacity;

    console.log(`\nMax capacity: ${activeGcps.length} GCPs × ${channelsPerProject} channels = ${maxCapacity} channels`);
    console.log(`Can assign all: ${canAssignAll ? '✅ YES' : '❌ NO'}`);

    if (!canAssignAll) {
      console.log(`⚠️ ${channels.length - maxCapacity} channels will be UNASSIGNED (need more GCPs)`);
    }

    // Simulate assignment
    const assignments = [];
    const gcpCounts = {};
    activeGcps.forEach(g => { gcpCounts[g.id] = 0; });

    for (const ch of channels) {
      // Find GCP with most remaining capacity
      let bestGcp = null;
      let bestRemaining = -1;
      
      for (const gcp of activeGcps) {
        const remaining = channelsPerProject - (gcpCounts[gcp.id] || 0);
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestGcp = gcp;
        }
      }

      if (bestGcp && bestRemaining > 0) {
        assignments.push({ channel: ch, gcp: bestGcp });
        gcpCounts[bestGcp.id] = (gcpCounts[bestGcp.id] || 0) + 1;
      } else {
        assignments.push({ channel: ch, gcp: null });
      }
    }

    console.log('\n=== ASSIGNMENT RESULT ===');
    for (const a of assignments) {
      const gcpName = a.gcp ? a.gcp.name : 'UNASSIGNED';
      const gcpStatus = a.gcp ? (a.gcp.status || 'active') : 'n/a';
      console.log(`  ${a.channel.channel_name} → ${gcpName} (${gcpStatus})`);
    }

    console.log('\n=== GCP SUMMARY ===');
    for (const gcp of activeGcps) {
      const assigned = gcpCounts[gcp.id] || 0;
      const dailyUploads = assigned * videosPerDay;
      const daysLeft = Math.floor((channelsPerProject * videosPerDay * 7) / Math.max(dailyUploads, 1));
      console.log(`  ${gcp.name}:`);
      console.log(`    Channels: ${assigned}/${channelsPerProject}`);
      console.log(`    Daily uploads: ${dailyUploads}/${channelsPerProject * videosPerDay}`);
      console.log(`    Est. days left: ~${daysLeft} days`);
    }

    const unassigned = assignments.filter(a => !a.gcp);
    if (unassigned.length > 0) {
      console.log(`\n⚠️ UNASSIGNED CHANNELS (${unassigned.length}):`);
      for (const a of unassigned) {
        console.log(`  - ${a.channel.channel_name}`);
      }
      console.log('Upload more GCP projects to assign these channels.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
