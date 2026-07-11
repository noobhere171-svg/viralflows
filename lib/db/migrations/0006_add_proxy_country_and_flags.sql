-- Add country and operation flags to global_proxies
ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_fetch boolean DEFAULT true;
ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_download boolean DEFAULT true;
ALTER TABLE global_proxies ADD COLUMN IF NOT EXISTS use_for_upload boolean DEFAULT false;
