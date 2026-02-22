-- Spotify カバー画像 URL と Spotify プレイリスト ID を playlists テーブルに追加
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS spotify_playlist_id TEXT;
