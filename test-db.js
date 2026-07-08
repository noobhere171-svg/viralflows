const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require', { connect_timeout: 15 });
sql`SELECT 1 as ok`.then(r => {
  console.log('DB OK:', r);
  sql.end();
}).catch(e => {
  console.log('DB ERROR:', e.code || e.message);
  process.exit(1);
});
