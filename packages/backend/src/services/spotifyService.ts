import type { Playlist, CreatePlaylistDto } from "@nestify/shared";
import { isMockMode, db } from "../db/index";
import { users, playlists, playlistTracks } from "../db/schema";
import { eq } from "drizzle-orm";
import { create, getTracksRecursive } from "./playlistService";
import type { Result } from "./playlistService";

// ---------------------------------------------------------------------------
// Spotify API 型定義
// ---------------------------------------------------------------------------

interface SpotifySimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracks: { total: number };
}

interface SpotifyPaginated<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SpotifyTrackItem {
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    preview_url: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// トークンリフレッシュ
// ---------------------------------------------------------------------------

export async function refreshAccessToken(
  refreshToken: string,
): Promise<Result<{ accessToken: string; expiresAt: Date }>> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { ok: false, error: "Spotify credentials not configured", status: 503 };
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: "Failed to refresh Spotify token", status: 500 };
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    ok: true,
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  };
}

// ---------------------------------------------------------------------------
// ユーザーの Spotify アクセストークンを取得（必要に応じてリフレッシュ）
// ---------------------------------------------------------------------------

async function getValidAccessToken(
  userId: string,
): Promise<Result<string>> {
  if (isMockMode) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) {
      return { ok: false, error: "Spotify credentials not configured", status: 503 };
    }
    return { ok: false, error: "Mock mode: real Spotify calls unavailable", status: 503 };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  const user = userRows[0];
  if (!user) return { ok: false, error: "User not found", status: 404 };

  // トークンが有効期限内なら再利用
  if (user.tokenExpiresAt > new Date()) {
    return { ok: true, data: user.accessToken };
  }

  // リフレッシュ
  const refreshResult = await refreshAccessToken(user.refreshToken);
  if (!refreshResult.ok) return refreshResult;

  // DB に保存
  await db
    .update(users)
    .set({
      accessToken: refreshResult.data.accessToken,
      tokenExpiresAt: refreshResult.data.expiresAt,
    })
    .where(eq(users.id, userId));

  return { ok: true, data: refreshResult.data.accessToken };
}

// ---------------------------------------------------------------------------
// ユーザーの Spotify プレイリスト一覧を取得
// ---------------------------------------------------------------------------

export async function getUserPlaylists(
  userId: string,
): Promise<Result<SpotifySimplifiedPlaylist[]>> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult.ok) return tokenResult;

  const all: SpotifySimplifiedPlaylist[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenResult.data}` },
    });

    if (!res.ok) {
      return { ok: false, error: "Failed to fetch Spotify playlists", status: 500 };
    }

    const page = (await res.json()) as SpotifyPaginated<SpotifySimplifiedPlaylist>;
    all.push(...page.items);
    url = page.next;
  }

  return { ok: true, data: all };
}

// ---------------------------------------------------------------------------
// Spotify プレイリストをインポート
// ---------------------------------------------------------------------------

export async function importSpotifyPlaylist(
  spotifyPlaylistId: string,
  userId: string,
  parentId: string | null = null,
): Promise<Result<Playlist>> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult.ok) return tokenResult;

  const token = tokenResult.data;

  // プレイリスト情報を取得
  const plRes = await fetch(
    `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}?fields=id,name,description,images`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!plRes.ok) {
    return { ok: false, error: "Failed to fetch Spotify playlist", status: 500 };
  }

  const plData = (await plRes.json()) as {
    id: string;
    name: string;
    images: { url: string }[];
  };

  // Nestify にプレイリストを作成
  const dto: CreatePlaylistDto = {
    name: plData.name,
    icon: "🎵",
    parentId,
  };

  const createResult = await create(dto, userId);
  if (!createResult.ok) return createResult;

  const newPlaylist = createResult.data;

  // トラックを取得して登録
  if (!isMockMode && db) {
    let tracksUrl: string | null =
      `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?limit=50&fields=items(track(id,name)),next`;
    let order = 0;

    while (tracksUrl) {
      const tracksRes = await fetch(tracksUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!tracksRes.ok) break;

      const tracksPage = (await tracksRes.json()) as SpotifyPaginated<SpotifyTrackItem>;

      const values = tracksPage.items
        .filter((item) => item.track !== null)
        .map((item) => ({
          playlistId: newPlaylist.id,
          spotifyTrackId: item.track!.id,
          order: order++,
        }));

      if (values.length > 0) {
        await db.insert(playlistTracks).values(values);
      }

      tracksUrl = tracksPage.next;
    }
  }

  return { ok: true, data: newPlaylist };
}

// ---------------------------------------------------------------------------
// Nestify プレイリストを Spotify に書き出し
// ---------------------------------------------------------------------------

export async function exportToSpotify(
  playlistId: string,
  userId: string,
): Promise<Result<{ spotifyPlaylistId: string; url: string }>> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult.ok) return tokenResult;

  const token = tokenResult.data;

  // 子孫含む全トラックを取得
  const tracksResult = await getTracksRecursive(playlistId, userId);
  if (!tracksResult.ok) return tracksResult;

  if (tracksResult.data.length === 0) {
    return { ok: false, error: "No tracks to export", status: 400 };
  }

  // Spotify ユーザー ID を取得
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    return { ok: false, error: "Failed to get Spotify user", status: 500 };
  }
  const me = (await meRes.json()) as { id: string };

  // プレイリスト名を取得
  let playlistName = "Nestify Export";
  if (!isMockMode && db) {
    const pl = await db
      .select({ name: playlists.name })
      .from(playlists)
      .where(eq(playlists.id, playlistId));
    if (pl[0]) playlistName = pl[0].name;
  }

  // Spotify に新規プレイリストを作成
  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${me.id}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: playlistName,
        description: "Exported from Nestify",
        public: false,
      }),
    },
  );

  if (!createRes.ok) {
    return { ok: false, error: "Failed to create Spotify playlist", status: 500 };
  }

  const created = (await createRes.json()) as {
    id: string;
    external_urls: { spotify: string };
  };

  // トラックを 100 件ずつ追加（Spotify API の上限）
  const uris = tracksResult.data.map(
    (t) => `spotify:track:${t.spotifyTrackId}`,
  );
  const CHUNK = 100;

  for (let i = 0; i < uris.length; i += CHUNK) {
    const chunk = uris.slice(i, i + CHUNK);
    await fetch(
      `https://api.spotify.com/v1/playlists/${created.id}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: chunk }),
      },
    );
  }

  return {
    ok: true,
    data: { spotifyPlaylistId: created.id, url: created.external_urls.spotify },
  };
}
