const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();

const sql = postgres(dbUrl, { max: 1 });

(async () => {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'`;
    console.log('OK: users.role column added');
  } catch(e) { console.log('SKIP users.role:', e.message); }

  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      display_name text NOT NULL,
      price integer DEFAULT 0,
      billing_period text DEFAULT 'yearly',
      features jsonb DEFAULT '{}',
      is_active boolean DEFAULT true,
      sort_order integer DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )`);
    console.log('OK: plans table created');
  } catch(e) { console.log('SKIP plans:', e.message); }

  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS plan_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) NOT NULL,
      requested_plan text NOT NULL,
      status text DEFAULT 'pending',
      admin_note text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )`);
    console.log('OK: plan_requests table created');
  } catch(e) { console.log('SKIP plan_requests:', e.message); }

  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS global_proxies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ip_address text NOT NULL,
      port integer NOT NULL,
      protocol text DEFAULT 'http',
      username text,
      password_encrypted text,
      status text DEFAULT 'active',
      speed_ms integer,
      assigned_to_plan text DEFAULT 'all',
      max_concurrent_users integer DEFAULT 5,
      current_users integer DEFAULT 0,
      last_tested_at timestamp,
      created_at timestamp DEFAULT now()
    )`);
    console.log('OK: global_proxies table created');
  } catch(e) { console.log('SKIP global_proxies:', e.message); }

  console.log('Migration complete!');
  await sql.end();
  process.exit(0);
})();
