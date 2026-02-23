ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS track_name TEXT;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS track_artists TEXT;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS album_name TEXT;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS track_image_url TEXT;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS metadata_cached_at TIMESTAMP;
