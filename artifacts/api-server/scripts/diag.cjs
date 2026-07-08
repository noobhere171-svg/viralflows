const http = require('http');

http.get('http://localhost:5000/api/workspaces/_diag', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const r = JSON.parse(data);
    
    console.log("=== WORKSPACES ===");
    console.log(JSON.stringify(r.workspaces, null, 2));
    
    console.log("\n=== CHANNELS ===");
    console.log(JSON.stringify(r.channels, null, 2));
    
    console.log("\n=== SOURCES ===");
    console.log(JSON.stringify(r.sources, null, 2));
    
    console.log("\n=== QUEUE BREAKDOWN ===");
    console.log(JSON.stringify(r.queueBreakdown, null, 2));
    
    console.log("\n=== UPLOADED (all) ===");
    console.log(JSON.stringify(r.uploadedItems, null, 2));
    
    console.log("\n=== FAILED/DEAD_LETTER ===");
    console.log(JSON.stringify(r.failedItems, null, 2));
    
    console.log("\n=== GCP CREDENTIALS ===");
    console.log(JSON.stringify(r.gcpCredentials, null, 2));
    
    console.log("\n=== SCHEDULES ===");
    console.log(JSON.stringify(r.schedules, null, 2));
  });
}).on('error', e => console.error(e));
