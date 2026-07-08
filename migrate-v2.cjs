const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function migrate() {
  console.log('Running migration...');

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP`;
  console.log('  + users.plan_expires_at');

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`;
  console.log('  + users.is_locked');

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP`;
  console.log('  + users.locked_at');

  await sql`ALTER TABLE plan_requests ADD COLUMN IF NOT EXISTS payment_method TEXT`;
  console.log('  + plan_requests.payment_method');

  await sql`ALTER TABLE plan_requests ADD COLUMN IF NOT EXISTS screenshot_url TEXT`;
  console.log('  + plan_requests.screenshot_url');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS payment_screenshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      requested_plan TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      screenshot_url TEXT,
      amount INTEGER DEFAULT 0,
      transaction_id TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  + payment_screenshots table');

  await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["Bank Transfer", "JazzCash", "EasyPaisa", "SadaPay", "NayaPay"]'`;
  console.log('  + plans.payment_methods');

  await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'`;
  console.log('  + plans.bank_details');

  await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_days INTEGER DEFAULT 365`;
  console.log('  + plans.billing_days');

  await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_labels JSONB DEFAULT '{}'`;
  console.log('  + plans.feature_labels');

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0`;
  console.log('  + users.token_version');

  console.log('Migration complete!');
  await sql.end();
}

migrate().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
