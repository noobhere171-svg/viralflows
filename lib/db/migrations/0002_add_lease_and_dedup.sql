-- Migration: Add lease-based processing lock and duplicate-upload prevention
-- Safe to run on live DB — all statements use IF NOT EXISTS / IF NOT NULL

ALTER TABLE video_queue ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;
ALTER TABLE video_queue ADD COLUMN IF NOT EXISTS source_video_id TEXT;
ALTER TABLE video_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS last_claimed_at TIMESTAMP;

-- Unique partial index: same TikTok video can't be uploaded to the same channel twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_vq_channel_video_uploaded
  ON video_queue(target_channel_id, source_video_id)
  WHERE status = 'uploaded';
