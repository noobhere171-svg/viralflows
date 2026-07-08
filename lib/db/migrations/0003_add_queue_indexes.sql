CREATE INDEX IF NOT EXISTS idx_video_queue_user_id ON video_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_video_queue_user_status ON video_queue(user_id, status);
