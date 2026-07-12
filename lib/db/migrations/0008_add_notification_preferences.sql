-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) UNIQUE,
  upload_complete boolean DEFAULT true,
  upload_failed boolean DEFAULT true,
  auth_expiring boolean DEFAULT true,
  quota_warning boolean DEFAULT true,
  new_source boolean DEFAULT true,
  weekly_report boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
