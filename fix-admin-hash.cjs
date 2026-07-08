const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();
const sql = postgres(dbUrl, { max: 1 });

const bcryptHash = process.argv[2];
const email = process.argv[3] || 'noobhere171@gmail.com';

(async () => {
  await sql`UPDATE users SET password_hash = ${bcryptHash} WHERE email = ${email}`;
  console.log(`Updated password for ${email}`);
  const [user] = await sql`SELECT email, role, plan FROM users WHERE email = ${email}`;
  console.log('User:', user);
  await sql.end();
  process.exit(0);
})();
