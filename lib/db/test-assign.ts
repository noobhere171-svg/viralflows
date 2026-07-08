function simulate(channelsCount: number, gcpCount: number) {
  const channelsPerProject = 2;
  const videosPerDay = 3;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`SIMULATION: ${channelsCount} channels + ${gcpCount} GCPs`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Rules: ${channelsPerProject} channels/GCP, ${videosPerDay} videos/channel/day`);
  console.log(`Daily limit per GCP: ${channelsPerProject * videosPerDay} uploads`);

  const maxCapacity = gcpCount * channelsPerProject;
  console.log(`Max capacity: ${gcpCount} GCPs × ${channelsPerProject} = ${maxCapacity} channels\n`);

  if (channelsCount > maxCapacity) {
    console.log(`⚠️ ${channelsCount - maxCapacity} channels will be UNASSIGNED\n`);
  }

  // Create mock data
  const channels = Array.from({ length: channelsCount }, (_, i) => ({
    id: `ch_${i + 1}`,
    name: `Channel ${i + 1}`,
  }));

  const gcps = Array.from({ length: gcpCount }, (_, i) => ({
    id: `gcp_${i + 1}`,
    name: `GCP Project ${i + 1}`,
    count: 0,
  }));

  // Smart assignment: fill evenly
  const assignments = [];
  for (const ch of channels) {
    // Find GCP with most remaining capacity
    let bestGcp = null;
    let bestRemaining = -1;

    for (const gcp of gcps) {
      const remaining = channelsPerProject - gcp.count;
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestGcp = gcp;
      }
    }

    if (bestGcp && bestRemaining > 0) {
      assignments.push({ channel: ch, gcp: bestGcp });
      bestGcp.count++;
    } else {
      assignments.push({ channel: ch, gcp: null });
    }
  }

  // Display assignments
  console.log('ASSIGNMENTS:');
  console.log('-'.repeat(50));
  for (const a of assignments) {
    const gcpName = a.gcp ? a.gcp.name : '❌ UNASSIGNED';
    console.log(`  ${a.channel.name} → ${gcpName}`);
  }

  // GCP summary
  console.log('\nGCP SUMMARY:');
  console.log('-'.repeat(50));
  for (const gcp of gcps) {
    const dailyUploads = gcp.count * videosPerDay;
    const maxDaily = channelsPerProject * videosPerDay;
    const daysLeft = Math.floor((maxDaily * 7) / Math.max(dailyUploads, 1));
    const status = dailyUploads <= maxDaily ? '✅ SAFE' : '⚠️ OVER LIMIT';
    console.log(`  ${gcp.name}: ${gcp.count}/${channelsPerProject} channels, ${dailyUploads}/${maxDaily} daily uploads, ~${daysLeft} days ${status}`);
  }

  const assigned = assignments.filter(a => a.gcp);
  const unassigned = assignments.filter(a => !a.gcp);
  console.log(`\nRESULT: ${assigned.length} assigned, ${unassigned.length} unassigned`);
}

// Test cases
simulate(10, 4);
simulate(14, 7);
simulate(5, 3);
simulate(8, 4);
simulate(3, 2);
