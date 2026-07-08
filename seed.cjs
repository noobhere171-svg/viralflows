const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();
const sql = postgres(dbUrl, { max: 1 });

const bankDetailsStarter = JSON.stringify({
  "Bank Transfer": {
    accountTitle: "ViralFlows",
    accountNumber: "1234567890",
    bankName: "HBL",
    iban: "PK1234567890123456789012",
  },
  "JazzCash": {
    accountNumber: "03001234567",
    accountHolderName: "ViralFlows",
  },
  "EasyPaisa": {
    accountNumber: "03001234567",
    accountHolderName: "ViralFlows",
  },
  "SadaPay": {
    accountNumber: "4111111111111111",
    accountHolderName: "ViralFlows",
  },
  "NayaPay": {
    accountNumber: "03001234567",
    accountHolderName: "ViralFlows",
  },
});

const defaultFeatureLabels = JSON.stringify({
  channels: "YouTube Channels",
  sources: "TikTok Sources",
  queueSize: "Queue Size",
  dailyUploads: "Daily Uploads",
  proxies: "Admin Proxies",
  customProxies: "Custom Proxies",
  autoRefill: "Auto-Refill",
  scheduledUpload: "Scheduled Upload",
  analyticsDays: "Analytics Days",
  aiSeo: "AI SEO",
  support: "Support Level",
  storageMb: "Storage (MB)",
});

const defaultPlans = [
  {
    name: 'free',
    display_name: 'Free Plan',
    price: 0,
    billing_period: 'yearly',
    billing_days: 365,
    features: JSON.stringify({
      channels: 1, sources: 2, queueSize: 10, dailyUploads: 3,
      proxies: 1, customProxies: 0, autoRefill: true, scheduledUpload: true,
      analyticsDays: 7, aiSeo: false, support: 'community', storageMb: 500,
    }),
    payment_methods: JSON.stringify(["Bank Transfer", "JazzCash", "EasyPaisa"]),
    bank_details: bankDetailsStarter,
    feature_labels: defaultFeatureLabels,
    sort_order: 0,
  },
  {
    name: 'starter',
    display_name: 'Starter Plan',
    price: 1500,
    billing_period: 'yearly',
    billing_days: 365,
    features: JSON.stringify({
      channels: 3, sources: 5, queueSize: 50, dailyUploads: 10,
      proxies: 3, customProxies: 2, autoRefill: true, scheduledUpload: true,
      analyticsDays: 30, aiSeo: true, support: 'email', storageMb: 2048,
    }),
    payment_methods: JSON.stringify(["Bank Transfer", "JazzCash", "EasyPaisa", "SadaPay", "NayaPay"]),
    bank_details: bankDetailsStarter,
    feature_labels: defaultFeatureLabels,
    sort_order: 1,
  },
  {
    name: 'pro',
    display_name: 'Pro Plan',
    price: 4999,
    billing_period: 'yearly',
    billing_days: 365,
    features: JSON.stringify({
      channels: 10, sources: 25, queueSize: 999999, dailyUploads: 50,
      proxies: 10, customProxies: 10, autoRefill: true, scheduledUpload: true,
      analyticsDays: 90, aiSeo: true, support: 'priority', storageMb: 10240,
    }),
    payment_methods: JSON.stringify(["Bank Transfer", "JazzCash", "EasyPaisa", "SadaPay", "NayaPay"]),
    bank_details: bankDetailsStarter,
    feature_labels: defaultFeatureLabels,
    sort_order: 2,
  },
  {
    name: 'agency',
    display_name: 'Agency Plan',
    price: 12999,
    billing_period: 'yearly',
    billing_days: 365,
    features: JSON.stringify({
      channels: 999999, sources: 999999, queueSize: 999999, dailyUploads: 999999,
      proxies: 999999, customProxies: 999999, autoRefill: true, scheduledUpload: true,
      analyticsDays: 999, aiSeo: true, support: '24/7', storageMb: 999999,
    }),
    payment_methods: JSON.stringify(["Bank Transfer", "JazzCash", "EasyPaisa", "SadaPay", "NayaPay"]),
    bank_details: bankDetailsStarter,
    feature_labels: defaultFeatureLabels,
    sort_order: 3,
  },
];

(async () => {
  for (const plan of defaultPlans) {
    try {
      await sql.unsafe(
        `INSERT INTO plans (name, display_name, price, billing_period, billing_days, features, payment_methods, bank_details, feature_labels, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, true, $10)
         ON CONFLICT (name) DO UPDATE SET
           display_name = $2, price = $3, billing_period = $4, billing_days = $5,
           features = $6::jsonb, payment_methods = $7::jsonb, bank_details = $8::jsonb,
           feature_labels = $9::jsonb, sort_order = $10`,
        [plan.name, plan.display_name, plan.price, plan.billing_period, plan.billing_days, plan.features, plan.payment_methods, plan.bank_details, plan.feature_labels, plan.sort_order]
      );
      console.log(`OK: Plan "${plan.name}" seeded`);
    } catch(e) { console.log(`SKIP plan "${plan.name}":`, e.message); }
  }

  const adminEmail = 'noobhere171@gmail.com';
  const adminPassword = 'ZA@11223344az';
  const passwordHash = hashPassword(adminPassword);

  try {
    await sql.unsafe(
      `INSERT INTO users (email, password_hash, name, auth_provider, account_setup_complete, plan, role)
       VALUES ($1, $2, 'Admin', 'email', true, 'pro', 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = $2, plan = 'pro'`,
      [adminEmail, passwordHash]
    );
    console.log(`OK: Admin user "${adminEmail}" created/updated`);
  } catch(e) { console.log('SKIP admin user:', e.message); }

  const plans = await sql`SELECT name, display_name, price FROM plans ORDER BY sort_order`;
  console.log('\nPlans in DB:', plans.map(p => `${p.display_name} (${p.price} PKR)`).join(', '));

  const admins = await sql`SELECT email, role FROM users WHERE role = 'admin'`;
  console.log('Admins:', admins.map(a => a.email).join(', '));

  await sql.end();
  process.exit(0);
})();
