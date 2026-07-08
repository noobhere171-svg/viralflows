const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});
(async () => {
  await client.connect();
  const res = await client.query("SELECT id, account_handle, content_filter FROM sources WHERE content_filter IS NOT NULL");
  for (const row of res.rows) {
    const f = typeof row.content_filter === 'string' ? JSON.parse(row.content_filter) : row.content_filter;
    if (!f.autoRefillEnabled) continue;
    const newFilter = { ...f, minViews: 0, minQueue: 5, refillAmount: 5, sortBy: 'all', autoRefillEnabled: true };
    await client.query('UPDATE sources SET content_filter = $1 WHERE id = $2', [JSON.stringify(newFilter), row.id]);
    console.log('Updated:', row.account_handle);
  }
  await client.end();
  console.log('Done!');
})();
