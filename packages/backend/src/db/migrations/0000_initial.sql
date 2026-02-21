-- Nestify 初回マイグレーション
-- Drizzle Kit 生成形式に準拠

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spotify_id" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "email" text,
  "image_url" text,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "parent_id" uuid REFERENCES "playlists"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "icon" text NOT NULL DEFAULT '🎵',
  "color" text NOT NULL DEFAULT 'linear-gradient(135deg,#7c6af7,#f76a8a)',
  "order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlist_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "playlist_id" uuid NOT NULL REFERENCES "playlists"("id") ON DELETE CASCADE,
  "spotify_track_id" text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "added_at" timestamp DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS "playlists_user_id_idx" ON "playlists"("user_id");
CREATE INDEX IF NOT EXISTS "playlists_parent_id_idx" ON "playlists"("parent_id");
CREATE INDEX IF NOT EXISTS "playlist_tracks_playlist_id_idx" ON "playlist_tracks"("playlist_id");
