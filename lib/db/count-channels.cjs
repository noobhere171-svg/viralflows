const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
async function main() {
  const [r] = await sql.unsafe('SELECT COUNT(*) as count FROM channels');
  console.log(`Remaining channels: ${r.count}`);
  const list = await sql.unsafe('SELECT channel_name, auth_status FROM channels ORDER BY created_at');
  for (const ch of list) console.log(`  ${ch.channel_name}: ${ch.auth_status}`);
  await sql.end();
}
main();
