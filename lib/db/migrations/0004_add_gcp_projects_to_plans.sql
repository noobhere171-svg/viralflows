-- Add gcpProjects and enforce flags to each plan's features JSONB
-- free: 1 GCP project, starter: 3, pro: 10, agency: unlimited (999999)

UPDATE plans SET features = features || '{"gcpProjects": 1, "_enforce_gcpProjects": true, "_enforce_dailySearches": true, "_enforce_proxies": true}'::jsonb WHERE name = 'free';

UPDATE plans SET features = features || '{"gcpProjects": 3, "_enforce_gcpProjects": true, "_enforce_dailySearches": true, "_enforce_proxies": true}'::jsonb WHERE name = 'starter';

UPDATE plans SET features = features || '{"gcpProjects": 10, "_enforce_gcpProjects": true, "_enforce_dailySearches": true, "_enforce_proxies": true}'::jsonb WHERE name = 'pro';

UPDATE plans SET features = features || '{"gcpProjects": 999999}'::jsonb WHERE name = 'agency';
