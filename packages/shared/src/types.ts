export interface Playlist {
  id: string;
  userId: string;
  name: string;
  icon: string; // emoji文字
  color: string; // CSSグラデーション文字列
  parentId: string | null; // null = ルートプレイリスト
  order: number; // 兄弟間の並び順
  createdAt: string;
  updatedAt: string;

  // APIレスポンス時に付与される仮想フィールド
  children?: Playlist[];
  tracks?: PlaylistTrack[];
  trackCount?: number; // 子孫を含む総曲数（再帰的に集計）
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  spotifyTrackId: string;
  order: number;
  addedAt: string;
  track?: SpotifyTrack; // Spotifyから取得したキャッシュ
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
  previewUrl: string | null;
  imageUrl: string | null;
}

// APIリクエスト型
export interface CreatePlaylistDto {
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

export interface UpdatePlaylistDto {
  name?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  order?: number;
}
