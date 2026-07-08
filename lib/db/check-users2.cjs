const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const users = await sql.unsafe(`SELECT id, clerk_id, email, created_at FROM users ORDER BY created_at`);
    console.log('=== ALL USERS ===');
    for (const u of users) {
      const chCount = await sql.unsafe(`SELECT COUNT(*) as count FROM channels WHERE user_id = '${u.id}'`);
      console.log(`  ${u.id}: clerkId=${u.clerk_id || 'NULL'}, email=${u.email || 'EMPTY'}, channels=${chCount[0].count}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
