import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  spotifyId: text("spotify_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  imageUrl: text("image_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentId: uuid("parent_id").references((): any => playlists.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🎵"),
  color: text("color")
    .notNull()
    .default("linear-gradient(135deg,#7c6af7,#f76a8a)"),
  imageUrl: text("image_url"),
  spotifyPlaylistId: text("spotify_playlist_id"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const playlistTracks = pgTable("playlist_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  spotifyTrackId: text("spotify_track_id").notNull(),
  order: integer("order").notNull().default(0),
  addedAt: timestamp("added_at").defaultNow(),
  // --- メタデータキャッシュカラム (nullable: 未取得は null) ---
  trackName: text("track_name"),
  trackArtists: text("track_artists"), // JSON 配列文字列: '["Artist1","Artist2"]'
  albumName: text("album_name"),
  durationMs: integer("duration_ms"),
  previewUrl: text("preview_url"),
  trackImageUrl: text("track_image_url"),
  metadataCachedAt: timestamp("metadata_cached_at"),
});

// Spotify OAuth PKCE フロー用の一時状態ストア
// CF Workers はステートレスなため、インメモリ Map の代わりに DB を使用する
export const pkceStates = pgTable("pkce_states", {
  state: text("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
