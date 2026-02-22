import type { Playlist, SpotifyTrack, CreatePlaylistDto, UpdatePlaylistDto } from "@nestify/shared";
import { isMockMode, db } from "../db/index";
import {
  MOCK_PLAYLISTS,
  MOCK_PLAYLISTS_FLAT,
  MOCK_TRACKS,
} from "../db/mock";
import { playlists, playlistTracks } from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export interface TrackWithSource {
  id: string;
  playlistId: string;
  spotifyTrackId: string;
  order: number;
  addedAt: string;
  sourcePlaylistName: string;
  track?: SpotifyTrack; // Spotify API から取得したメタデータ（後付け）
}

// ---------------------------------------------------------------------------
// モックモード用ヘルパー
// ---------------------------------------------------------------------------

function findFlatById(id: string): Playlist | undefined {
  return MOCK_PLAYLISTS_FLAT.find((p) => p.id === id);
}

function buildTree(userId: string): Playlist[] {
  // ルートのみ返す（children はすでにネストされている）
  return MOCK_PLAYLISTS.filter((p) => p.userId === userId || true);
}

function collectDescendantIds(id: string): string[] {
  const result: string[] = [id];
  const children = MOCK_PLAYLISTS_FLAT.filter((p) => p.parentId === id);
  for (const child of children) {
    result.push(...collectDescendantIds(child.id));
  }
  return result;
}

// ---------------------------------------------------------------------------
// サービス関数
// ---------------------------------------------------------------------------

/** ツリー全体取得（ルートプレイリスト + children ネスト済み） */
export async function getTree(
  userId: string,
): Promise<Result<Playlist[]>> {
  if (isMockMode) {
    return { ok: true, data: buildTree(userId) };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  // DB からフラットに取得してツリーに変換
  const rows = await db
    .select()
    .from(playlists)
    .where(eq(playlists.userId, userId));

  const map = new Map<string, Playlist>();
  for (const row of rows) {
    map.set(row.id, {
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
      children: [],
    });
  }

  const roots: Playlist[] = [];
  for (const playlist of map.values()) {
    if (playlist.parentId === null) {
      roots.push(playlist);
    } else {
      const parent = map.get(playlist.parentId);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(playlist);
      }
    }
  }

  // order でソート
  const sortByOrder = (items: Playlist[]): Playlist[] =>
    items
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        ...p,
        children: p.children ? sortByOrder(p.children) : undefined,
      }));

  return { ok: true, data: sortByOrder(roots) };
}

/** 単一プレイリスト取得 */
export async function getById(
  id: string,
  userId: string,
): Promise<Result<Playlist>> {
  if (isMockMode) {
    const found = findFlatById(id);
    if (!found) return { ok: false, error: "Playlist not found", status: 404 };
    return { ok: true, data: found };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  const rows = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

  const row = rows[0];
  if (!row) return { ok: false, error: "Playlist not found", status: 404 };

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

/** プレイリスト作成 */
export async function create(
  dto: CreatePlaylistDto,
  userId: string,
): Promise<Result<Playlist>> {
  if (isMockMode) {
    const siblings = MOCK_PLAYLISTS_FLAT.filter(
      (p) => p.parentId === (dto.parentId ?? null),
    );
    const newPlaylist: Playlist = {
      id: randomUUID(),
      userId,
      name: dto.name,
      icon: dto.icon ?? "🎵",
      color: dto.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)",
      parentId: dto.parentId ?? null,
      order: siblings.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_PLAYLISTS_FLAT.push(newPlaylist);
    return { ok: true, data: newPlaylist };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  // 末尾 order を計算
  const siblingRows = await db
    .select({ order: playlists.order })
    .from(playlists)
    .where(
      and(
        eq(playlists.userId, userId),
        dto.parentId
          ? eq(playlists.parentId, dto.parentId)
          : isNull(playlists.parentId),
      ),
    );
  const maxOrder = siblingRows.reduce(
    (max, r) => Math.max(max, r.order),
    -1,
  );

  const inserted = await db
    .insert(playlists)
    .values({
      userId,
      name: dto.name,
      icon: dto.icon ?? "🎵",
      color: dto.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)",
      imageUrl: dto.imageUrl ?? null,
      spotifyPlaylistId: dto.spotifyPlaylistId ?? null,
      parentId: dto.parentId ?? null,
      order: maxOrder + 1,
    })
    .returning();

  const row = inserted[0];
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

/** プレイリスト更新 */
export async function update(
  id: string,
  dto: UpdatePlaylistDto,
  userId: string,
): Promise<Result<Playlist>> {
  if (isMockMode) {
    const index = MOCK_PLAYLISTS_FLAT.findIndex((p) => p.id === id);
    if (index === -1) {
      return { ok: false, error: "Playlist not found", status: 404 };
    }
    const current = MOCK_PLAYLISTS_FLAT[index];
    const updated: Playlist = {
      ...current,
      name: dto.name ?? current.name,
      icon: dto.icon ?? current.icon,
      color: dto.color ?? current.color,
      parentId: dto.parentId !== undefined ? dto.parentId : current.parentId,
      order: dto.order !== undefined ? dto.order : current.order,
      updatedAt: new Date().toISOString(),
    };
    MOCK_PLAYLISTS_FLAT[index] = updated;
    return { ok: true, data: updated };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  const updated = await db
    .update(playlists)
    .set({
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      ...(dto.order !== undefined && { order: dto.order }),
      updatedAt: new Date(),
    })
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .returning();

  const row = updated[0];
  if (!row) return { ok: false, error: "Playlist not found", status: 404 };

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

/** プレイリスト削除（cascade で子も削除） */
export async function deletePlaylist(
  id: string,
  userId: string,
): Promise<Result<{ deleted: boolean }>> {
  if (isMockMode) {
    const found = findFlatById(id);
    if (!found) return { ok: false, error: "Playlist not found", status: 404 };

    const idsToDelete = collectDescendantIds(id);
    for (const pid of idsToDelete) {
      const idx = MOCK_PLAYLISTS_FLAT.findIndex((p) => p.id === pid);
      if (idx !== -1) MOCK_PLAYLISTS_FLAT.splice(idx, 1);
    }
    return { ok: true, data: { deleted: true } };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  const deleted = await db
    .delete(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .returning({ id: playlists.id });

  if (deleted.length === 0) {
    return { ok: false, error: "Playlist not found", status: 404 };
  }

  return { ok: true, data: { deleted: true } };
}

/** 子孫を含む全トラック取得（再帰 CTE） */
export async function getTracksRecursive(
  id: string,
  userId: string,
): Promise<Result<TrackWithSource[]>> {
  if (isMockMode) {
    const descendantIds = collectDescendantIds(id);
    const tracks: TrackWithSource[] = [];

    for (const pid of descendantIds) {
      const playlist = findFlatById(pid);
      const playlistTracks = MOCK_TRACKS.filter((t) => t.playlistId === pid);
      for (const t of playlistTracks) {
        tracks.push({
          id: t.id,
          playlistId: t.playlistId,
          spotifyTrackId: t.spotifyTrackId,
          order: t.order,
          addedAt: t.addedAt,
          sourcePlaylistName: playlist?.name ?? "",
        });
      }
    }

    return { ok: true, data: tracks };
  }

  if (!db) return { ok: false, error: "DB not initialized", status: 500 };

  // 所有権チェック
  const ownerCheck = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

  if (ownerCheck.length === 0) {
    return { ok: false, error: "Playlist not found", status: 404 };
  }

  const result = (await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, name FROM playlists WHERE id = ${id}
      UNION ALL
      SELECT p.id, p.name FROM playlists p
      INNER JOIN descendants d ON p.parent_id = d.id
    )
    SELECT
      pt.id,
      pt.playlist_id AS "playlistId",
      pt.spotify_track_id AS "spotifyTrackId",
      pt.order,
      pt.added_at AS "addedAt",
      d.name AS "sourcePlaylistName"
    FROM playlist_tracks pt
    JOIN descendants d ON d.id = pt.playlist_id
    ORDER BY pt.order
  `)) as unknown as TrackWithSource[];

  return { ok: true, data: result };
}
