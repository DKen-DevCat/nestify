import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  getTree,
  getById,
  create,
  update,
  deletePlaylist,
  getTracksRecursive,
  reorderTracks,
  reorderItems,
  addTrack,
} from "../services/playlistService";
import { enrichTracksWithSpotifyData } from "../services/spotifyService";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().uuid().nullish(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

type Variables = { userId: string };

// Result の status を ContentfulStatusCode にキャストするヘルパー
function toHttpStatus(status?: number): ContentfulStatusCode {
  return (status ?? 500) as ContentfulStatusCode;
}

export const playlistRoutes = new Hono<{ Variables: Variables }>();

playlistRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await getTree(userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

playlistRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await getById(id, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

playlistRoutes.get("/:id/tracks", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await getTracksRecursive(id, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  // Spotify トラックメタデータ（曲名・アーティスト・再生時間）を付与
  const enriched = await enrichTracksWithSpotifyData(result.data, userId);
  return c.json({ ok: true, data: enriched });
});

playlistRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId");
  const dto = c.req.valid("json");
  const result = await create(
    {
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      parentId: dto.parentId ?? null,
    },
    userId,
  );
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data }, 201);
});

playlistRoutes.patch(
  "/:id/items/reorder",
  zValidator(
    "json",
    z.object({
      items: z.array(
        z.object({
          type: z.enum(["track", "playlist"]),
          id: z.string().uuid(),
        }),
      ),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { items } = c.req.valid("json");
    const result = await reorderItems(id, items, userId);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
    }
    return c.json({ ok: true, data: result.data });
  },
);

playlistRoutes.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const dto = c.req.valid("json");
  const result = await update(id, dto, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});

playlistRoutes.post(
  "/:id/tracks",
  zValidator("json", z.object({ spotifyTrackId: z.string().min(1) })),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { spotifyTrackId } = c.req.valid("json");
    const result = await addTrack(id, spotifyTrackId, userId);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
    }
    return c.json({ ok: true, data: result.data }, 201);
  },
);

playlistRoutes.patch(
  "/:id/tracks/reorder",
  zValidator("json", z.object({ orderedIds: z.array(z.string().uuid()) })),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { orderedIds } = c.req.valid("json");
    const result = await reorderTracks(id, orderedIds, userId);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
    }
    return c.json({ ok: true, data: result.data });
  },
);

playlistRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await deletePlaylist(id, userId);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, toHttpStatus(result.status));
  }
  return c.json({ ok: true, data: result.data });
});
