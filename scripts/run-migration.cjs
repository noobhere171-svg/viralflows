// Run migration SQL against Neon DB
const postgres = require("postgres");

// Read .env file manually
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envLines = envContent.split("\n").filter(l => l.trim() && !l.startsWith("#"));
for (const line of envLines) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString, { ssl: "require", connect_timeout: 60 });

async function main() {
  try {
    console.log("Running migration...");

    // Add columns to users table
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS search_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS search_count_reset_at TIMESTAMP`;
    console.log("Users table updated (search_count, search_count_reset_at)");

    // Create feature_definitions table
    await sql`
      CREATE TABLE IF NOT EXISTS feature_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        type TEXT DEFAULT 'number',
        default_val JSONB DEFAULT '0',
        sort_order INTEGER DEFAULT 0,
        is_enforced BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log("feature_definitions table created");

    // Insert default features
    const features = [
      { key: "channels", label: "YouTube Channels", type: "number", default_val: "1", sort_order: 1, is_enforced: false },
      { key: "sources", label: "TikTok Sources", type: "number", default_val: "3", sort_order: 2, is_enforced: false },
      { key: "gcpProjects", label: "GCP Projects", type: "number", default_val: "1", sort_order: 3, is_enforced: true },
      { key: "dailyUploads", label: "Daily Uploads", type: "number", default_val: "3", sort_order: 4, is_enforced: false },
      { key: "dailySearches", label: "Daily Searches", type: "number", default_val: "3", sort_order: 5, is_enforced: true },
      { key: "queueSize", label: "Queue Size", type: "number", default_val: "10", sort_order: 6, is_enforced: false },
      { key: "proxies", label: "Admin Proxies", type: "number", default_val: "0", sort_order: 7, is_enforced: true },
      { key: "customProxies", label: "Custom Proxies", type: "number", default_val: "0", sort_order: 8, is_enforced: false },
      { key: "analyticsDays", label: "Analytics Days", type: "number", default_val: "7", sort_order: 9, is_enforced: false },
      { key: "storageMb", label: "Storage (MB)", type: "number", default_val: "500", sort_order: 10, is_enforced: false },
      { key: "autoRefill", label: "Auto-Refill", type: "boolean", default_val: "false", sort_order: 11, is_enforced: false },
      { key: "scheduledUpload", label: "Scheduled Upload", type: "boolean", default_val: "false", sort_order: 12, is_enforced: false },
      { key: "aiSeo", label: "AI SEO", type: "boolean", default_val: "false", sort_order: 13, is_enforced: false },
    ];

    for (const f of features) {
      await sql`
        INSERT INTO feature_definitions (key, label, type, default_val, sort_order, is_enforced)
        VALUES (${f.key}, ${f.label}, ${f.type}, ${f.default_val}::jsonb, ${f.sort_order}, ${f.is_enforced})
        ON CONFLICT (key) DO NOTHING
      `;
    }
    console.log(`${features.length} feature definitions inserted`);

    // Also update existing plans features to include new keys if missing
    const plans = await sql`SELECT id, name, features FROM plans`;
    for (const plan of plans) {
      let feats = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
      let changed = false;
      if (feats.gcpProjects === undefined) { feats.gcpProjects = 1; changed = true; }
      if (feats.dailySearches === undefined) { feats.dailySearches = 3; changed = true; }
      if (feats.proxies === undefined) { feats.proxies = 0; changed = true; }
      if (changed) {
        await sql`UPDATE plans SET features = ${JSON.stringify(feats)}::jsonb WHERE id = ${plan.id}`;
        console.log(`  Updated plan "${plan.name}" with new features`);
      }
    }

    console.log("\nMigration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
