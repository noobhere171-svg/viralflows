CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp DEFAULT now()
);

INSERT INTO admin_settings (key, value) VALUES ('auto_approve_upgrades', 'false')
ON CONFLICT (key) DO NOTHING;
