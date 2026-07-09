-- Add search count columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_count_reset_at TIMESTAMP;

-- Create feature_definitions table
CREATE TABLE IF NOT EXISTS feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'number',
  default_val JSONB DEFAULT '0',
  sort_order INTEGER DEFAULT 0,
  is_enforced BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default feature definitions
INSERT INTO feature_definitions (key, label, type, default_val, sort_order, is_enforced) VALUES
  ('channels', 'YouTube Channels', 'number', '1', 1, false),
  ('sources', 'TikTok Sources', 'number', '3', 2, false),
  ('gcpProjects', 'GCP Projects', 'number', '1', 3, true),
  ('dailyUploads', 'Daily Uploads', 'number', '3', 4, false),
  ('dailySearches', 'Daily Searches', 'number', '3', 5, true),
  ('queueSize', 'Queue Size', 'number', '10', 6, false),
  ('proxies', 'Admin Proxies', 'number', '0', 7, true),
  ('customProxies', 'Custom Proxies', 'number', '0', 8, false),
  ('analyticsDays', 'Analytics Days', 'number', '7', 9, false),
  ('storageMb', 'Storage (MB)', 'number', '500', 10, false),
  ('autoRefill', 'Auto-Refill', 'boolean', 'false', 11, false),
  ('scheduledUpload', 'Scheduled Upload', 'boolean', 'false', 12, false),
  ('aiSeo', 'AI SEO', 'boolean', 'false', 13, false)
ON CONFLICT (key) DO NOTHING;
