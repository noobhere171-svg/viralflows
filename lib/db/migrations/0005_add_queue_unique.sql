-- Prevent duplicate video inserts at DB level for each source
-- Safe to run on live DB — uses IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS idx_vq_source_video_unique
  ON video_queue(source_id, source_video_id)
  WHERE source_video_id IS NOT NULL;
