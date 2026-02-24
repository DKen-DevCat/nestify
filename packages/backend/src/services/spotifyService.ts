import type { Playlist, SpotifyTrack } from "@nestify/shared";
import { isMockMode, db } from "../db/index";
import { users, playlists, playlistTracks } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { create, getTracksRecursive } from "./playlistService";
import type { Result, TrackWithSource } from "./playlistService";
import { MOCK_PLAYLISTS_FLAT } from "../db/mock";

// ---------------------------------------------------------------------------
// Spotify API 型定義
// ---------------------------------------------------------------------------

interface SpotifySimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracks?: { total: number } | null;
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
    signal: AbortSignal.timeout(10_000),
  }).catch((): null => null);

  if (!res) {
    return { ok: false, error: "Spotify token refresh timed out", status: 504 };
  }
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
// Spotify トラック検索
// ---------------------------------------------------------------------------

export async function searchTracks(
  query: string,
  userId: string,
): Promise<Result<SpotifyTrack[]>> {
  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult.ok) return tokenResult;

  const token = tokenResult.data;
  // market を指定しないことで全世界の楽曲を検索対象にする（部分一致検索も Spotify が自動対応）
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch((): null => null);

  if (!res) {
    return { ok: false, error: "Spotify search request timed out", status: 504 };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Spotify search failed (${res.status})${body ? `: ${body.slice(0, 100)}` : ""}`,
      status: 500,
    };
  }

  const data = (await res.json()) as {
    tracks?: {
      items: Array<{
        id: string;
        name: string;
        artists: { name: string }[];
        album: { name: string; images: { url: string }[] };
        duration_ms: number;
        preview_url: string | null;
      }>;
    };
  };

  // Spotify が予期しない構造を返した場合の安全処理
  if (!data.tracks?.items) {
    return { ok: true, data: [] };
  }

  const tracks: SpotifyTrack[] = data.tracks.items.map((item) => ({
    id: item.id,
    name: item.name,
    artists: item.artists.map((a) => a.name),
    album: item.album.name,
    durationMs: item.duration_ms,
    previewUrl: item.preview_url,
    imageUrl: item.album.images[0]?.url ?? null,
  }));

  return { ok: true, data: tracks };
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
// Spotify トラックメタデータをバッチ取得してトラックに付与（Bug 1 修正）
// ---------------------------------------------------------------------------

export async function enrichTracksWithSpotifyData(
  tracks: TrackWithSource[],
  userId: string,
): Promise<TrackWithSource[]> {
  if (tracks.length === 0) return tracks;

  // キャッシュ済みのトラックをスキップ
  const uncached = tracks.filter((t) => !t.track);
  if (uncached.length === 0) return tracks; // 全キャッシュ済みなら即リターン

  const tokenResult = await getValidAccessToken(userId);
  if (!tokenResult.ok) return tracks; // トークン取得失敗時はメタデータなしで返す

  const token = tokenResult.data;
  const ids = [...new Set(uncached.map((t) => t.spotifyTrackId))];

  const metaMap = new Map<string, SpotifyTrack>();

  // Spotify API は 1 回あたり最大 50 件
  const CHUNK = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${chunk.join(",")}&market=JP`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    ).catch((): null => null);
    if (!res || !res.ok) continue;

    const data = (await res.json()) as { tracks: Array<{
      id: string;
      name: string;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
      duration_ms: number;
      preview_url: string | null;
    } | null> };

    for (const t of data.tracks) {
      if (!t) continue;
      metaMap.set(t.id, {
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        album: t.album.name,
        durationMs: t.duration_ms,
        previewUrl: t.preview_url,
        imageUrl: t.album.images[0]?.url ?? null,
      });
    }
  }

  // DB に非同期でキャッシュ保存（レスポンスをブロックしない）
  if (!isMockMode && db) {
    Promise.all(
      uncached.map((t) => {
        const meta = metaMap.get(t.spotifyTrackId);
        if (!meta) return Promise.resolve();
        return db!
          .update(playlistTracks)
          .set({
            trackName: meta.name,
            trackArtists: JSON.stringify(meta.artists),
            albumName: meta.album,
            durationMs: meta.durationMs,
            previewUrl: meta.previewUrl,
            trackImageUrl: meta.imageUrl,
            metadataCachedAt: new Date(),
          })
          .where(eq(playlistTracks.id, t.id));
      }),
    ).catch(() => {
      /* キャッシュ失敗は無視 */
    });
  }

  return tracks.map((t) => ({
    ...t,
    track: t.track ?? metaMap.get(t.spotifyTrackId),
  }));
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

  // Bug 2: 重複チェック — 同じ Spotify プレイリストをすでにインポート済みか確認
  if (!isMockMode && db) {
    const existing = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.spotifyPlaylistId, spotifyPlaylistId),
        ),
      );
    if (existing.length > 0) {
      const row = existing[0];
      return {
        ok: true,
        data: {
          id: row.id,
          userId: row.userId,
          name: row.name,
          icon: row.icon,
          color: row.color,
          imageUrl: row.imageUrl ?? null,
          spotifyPlaylistId: row.spotifyPlaylistId ?? null,
          parentId: row.parentId ?? null,
          order: row.order,
          createdAt: row.createdAt?.toISOString() ?? "",
          updatedAt: row.updatedAt?.toISOString() ?? "",
        },
      };
    }
  }

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

  // Bug 3: Spotify カバー画像 URL を保存
  const imageUrl = plData.images[0]?.url ?? null;

  // Nestify にプレイリストを作成
  const createResult = await create(
    {
      name: plData.name,
      icon: "🎵",
      imageUrl,
      spotifyPlaylistId,
      parentId,
    },
    userId,
  );
  if (!createResult.ok) return createResult;

  const newPlaylist = createResult.data;

  // トラックを取得して登録
  if (!isMockMode && db) {
    let tracksUrl: string | null =
      `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?limit=50&fields=items(track(id)),next`;
    let order = 0;

    while (tracksUrl) {
      const tracksRes = await fetch(tracksUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!tracksRes.ok) break;

      const tracksPage = (await tracksRes.json()) as SpotifyPaginated<SpotifyTrackItem>;

      const values = (tracksPage.items ?? [])
        .filter((item) => item?.track != null)
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
// 既存の spotifyPlaylistId があれば更新、なければ新規作成して ID を保存する
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

  const uris = tracksResult.data.map((t) => `spotify:track:${t.spotifyTrackId}`);

  // プレイリスト情報を取得（名前 + 既存の spotifyPlaylistId）
  let playlistName = "Nestify Export";
  let existingSpotifyId: string | null = null;

  if (!isMockMode && db) {
    const pl = await db
      .select({ name: playlists.name, spotifyPlaylistId: playlists.spotifyPlaylistId })
      .from(playlists)
      .where(eq(playlists.id, playlistId));
    if (pl[0]) {
      playlistName = pl[0].name;
      existingSpotifyId = pl[0].spotifyPlaylistId ?? null;
    }
  }

  // --- 既存 Spotify プレイリストへの更新を試みる ---
  if (existingSpotifyId) {
    // メタデータ更新（名前・説明）
    const metaRes = await fetch(
      `https://api.spotify.com/v1/playlists/${existingSpotifyId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: playlistName, description: "Exported from Nestify" }),
      },
    );

    // 404 や権限エラーの場合は新規作成にフォールバック
    if (metaRes.ok || metaRes.status === 200) {
      // トラックを差し替え（PUT = 全置換、100件まで）
      const replaceRes = await fetch(
        `https://api.spotify.com/v1/playlists/${existingSpotifyId}/tracks`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: uris.slice(0, 100) }),
        },
      );

      if (replaceRes.ok) {
        // 101件目以降を追加（POST = append）
        for (let i = 100; i < uris.length; i += 100) {
          await fetch(`https://api.spotify.com/v1/playlists/${existingSpotifyId}/tracks`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
          });
        }

        return {
          ok: true,
          data: {
            spotifyPlaylistId: existingSpotifyId,
            url: `https://open.spotify.com/playlist/${existingSpotifyId}`,
          },
        };
      }
    }

    // 更新失敗 → 新規作成にフォールバック（spotifyPlaylistId をリセット）
    existingSpotifyId = null;
  }

  // --- 新規 Spotify プレイリストを作成 ---
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    return { ok: false, error: "Failed to get Spotify user", status: 500 };
  }
  const me = (await meRes.json()) as { id: string };

  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${me.id}/playlists`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  // トラックを 100 件ずつ追加
  for (let i = 0; i < uris.length; i += 100) {
    await fetch(`https://api.spotify.com/v1/playlists/${created.id}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  // 作成した spotifyPlaylistId を DB に保存（次回以降は更新として処理）
  if (!isMockMode && db) {
    await db
      .update(playlists)
      .set({ spotifyPlaylistId: created.id })
      .where(eq(playlists.id, playlistId));
  }

  return {
    ok: true,
    data: { spotifyPlaylistId: created.id, url: created.external_urls.spotify },
  };
}

/** プレイリスト + 全子孫プレイリストをそれぞれ独立した Spotify プレイリストとして書き出す */
export async function exportSubtreeToSpotify(
  rootId: string,
  userId: string,
): Promise<Result<Record<string, { spotifyPlaylistId: string; url: string }>>> {
  // ── 全子孫 ID を収集 ──────────────────────────────────────────────────────
  let descendantIds: string[];

  if (isMockMode) {
    // mock: MOCK_PLAYLISTS_FLAT を再帰的に辿る
    const collect = (id: string): string[] => {
      const children = MOCK_PLAYLISTS_FLAT.filter((p) => p.parentId === id);
      return [id, ...children.flatMap((c) => collect(c.id))];
    };
    descendantIds = collect(rootId);
  } else {
    if (!db) return { ok: false, error: "DB not initialized", status: 500 };

    const ownerCheck = await db
      .select({ id: playlists.id })
      .from(playlists)
      .where(and(eq(playlists.id, rootId), eq(playlists.userId, userId)));
    if (ownerCheck.length === 0) {
      return { ok: false, error: "Playlist not found", status: 404 };
    }

    const rows = (await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM playlists WHERE id = ${rootId}
        UNION ALL
        SELECT p.id FROM playlists p
        INNER JOIN descendants d ON p.parent_id = d.id
      )
      SELECT id FROM descendants
    `)) as unknown as { id: string }[];

    descendantIds = rows.map((r) => r.id);
  }

  // ── 各プレイリストを順に書き出す ──────────────────────────────────────────
  const exported: Record<string, { spotifyPlaylistId: string; url: string }> = {};

  for (const pid of descendantIds) {
    const result = await exportToSpotify(pid, userId);
    if (result.ok) {
      exported[pid] = result.data;
    }
    // 曲なし等の失敗はスキップ（他のプレイリストは続行）
  }

  if (!exported[rootId]) {
    return {
      ok: false,
      error: "ルートプレイリストの書き出しに失敗しました（曲がない可能性があります）",
      status: 400,
    };
  }

  return { ok: true, data: exported };
}
