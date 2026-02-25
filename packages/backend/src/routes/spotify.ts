import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  getUserPlaylists,
  importSpotifyPlaylist,
  exportToSpotify,
  exportSubtreeToSpotify,
  searchTracks,
  searchAlbums,
  getAlbumWithTracks,
} from "../services/spotifyService";

type Variables = { userId: string };

function toHttpStatus(status?: number): ContentfulStatusCode {
  return (status ?? 500) as ContentfulStatusCode;
}

export const spotifyRoutes = new Hono<{ Variables: Variables }>();

/** Spotify トラック検索 */
spotifyRoutes.get("/search", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ ok: false, error: "Query parameter 'q' is required" }, 400);
  }
  const result = await searchTracks(q.trim(), userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

/** ユーザーの Spotify プレイリスト一覧 */
spotifyRoutes.get("/me/playlists", async (c) => {
  const userId = c.get("userId");
  const result = await getUserPlaylists(userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

/** Spotify プレイリストを Nestify にインポート */
spotifyRoutes.post(
  "/import",
  zValidator(
    "json",
    z.object({
      spotifyPlaylistId: z.string().min(1),
      parentId: z.string().uuid().nullable().optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { spotifyPlaylistId, parentId } = c.req.valid("json");
    const result = await importSpotifyPlaylist(
      spotifyPlaylistId,
      userId,
      parentId ?? null,
    );
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
    }
    return c.json({ ok: true, data: result.data }, 201);
  },
);

/** Nestify プレイリストを Spotify に書き出し（単体） */
spotifyRoutes.post("/export/:playlistId", async (c) => {
  const userId = c.get("userId");
  const playlistId = c.req.param("playlistId");
  const result = await exportToSpotify(playlistId, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

/** Nestify プレイリスト + 全子孫を Spotify にそれぞれ書き出し */
spotifyRoutes.post("/export-tree/:playlistId", async (c) => {
  const userId = c.get("userId");
  const playlistId = c.req.param("playlistId");
  const result = await exportSubtreeToSpotify(playlistId, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

/** Spotify アルバム検索 */
spotifyRoutes.get("/albums/search", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ ok: false, error: "Query parameter 'q' is required" }, 400);
  }
  const result = await searchAlbums(q.trim(), userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

/** Spotify アルバムの全トラックを取得 */
spotifyRoutes.get("/albums/:albumId/tracks", async (c) => {
  const userId = c.get("userId");
  const albumId = c.req.param("albumId");
  const result = await getAlbumWithTracks(albumId, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});
