const postgres = require('postgres');
async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  const rows = await sql`SELECT id, user_id, email FROM workspaces ORDER BY user_id, email, created_at`;
  const groups = {};
  for (const r of rows) {
    const k = r.user_id + '|' + (r.email||'');
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }
  let merged = 0;
  for (const [k, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;
    const keep = list[0];
    for (let i = 1; i < list.length; i++) {
      const extra = list[i];
      const chs = await sql`SELECT id FROM channels WHERE workspace_id = ${extra.id}`;
      if (chs.length > 0) {
        await sql`UPDATE channels SET workspace_id = ${keep.id} WHERE workspace_id = ${extra.id}`;
        console.log('Moved', chs.length, 'channels from', extra.id.slice(0,8), 'to', keep.id.slice(0,8));
      }
      console.log('Duplicate:', extra.id.slice(0,8), extra.email, '- channels moved, safe to delete');
      merged++;
    }
  }
  console.log('Done. Merged:', merged);
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
