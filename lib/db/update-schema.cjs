const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    await sql.unsafe("ALTER TABLE gcp_credentials ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
    console.log('Added status column');

    await sql.unsafe("ALTER TABLE gcp_credentials ADD COLUMN IF NOT EXISTS daily_upload_count INTEGER DEFAULT 0");
    console.log('Added daily_upload_count column');

    await sql.unsafe("ALTER TABLE gcp_credentials ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP DEFAULT NOW()");
    console.log('Added last_reset_at column');

    await sql.unsafe("ALTER TABLE gcp_credentials ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP");
    console.log('Added blocked_at column');

    console.log('All columns added successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
