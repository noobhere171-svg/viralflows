const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    const users = await sql.unsafe(`SELECT id, email FROM users`);
    console.log('Users:');
    for (const u of users) {
      const chCount = await sql.unsafe(`SELECT COUNT(*) as count FROM channels WHERE user_id = '${u.id}'`);
      console.log(`  ${u.email}: ${chCount[0].count} channels (id: ${u.id})`);
    }

    // Check channel user_ids
    const channelUsers = await sql.unsafe(`
      SELECT user_id, COUNT(*) as count 
      FROM channels 
      GROUP BY user_id
    `);
    console.log('\nChannels by user_id:');
    for (const cu of channelUsers) {
      const user = await sql.unsafe(`SELECT email FROM users WHERE id = '${cu.user_id}'`);
      console.log(`  ${user[0]?.email || cu.user_id}: ${cu.count} channels`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
