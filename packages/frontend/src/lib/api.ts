import type { Playlist } from "@nestify/shared";

export interface SpotifySimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracks: { total: number };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("nestify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  // 401: トークン期限切れ → クリアしてログインへ
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("nestify_token");
      document.cookie = "nestify_token=; path=/; max-age=0";
      window.location.replace("/login");
    }
    return { ok: false, error: "Unauthorized" };
  }

  const json = (await res.json()) as
    | { ok: true; data: T }
    | { ok: false; error: string };
  return json;
}

export interface TrackWithSource {
  id: string;
  playlistId: string;
  spotifyTrackId: string;
  order: number;
  addedAt: string;
  sourcePlaylistName: string;
  track?: import("@nestify/shared").SpotifyTrack;
}

export const api = {
  playlists: {
    list: () => apiFetch<Playlist[]>("/api/playlists"),
    get: (id: string) => apiFetch<Playlist>(`/api/playlists/${id}`),
    tracks: (id: string) =>
      apiFetch<TrackWithSource[]>(`/api/playlists/${id}/tracks`),
    create: (data: import("@nestify/shared").CreatePlaylistDto) =>
      apiFetch<Playlist>("/api/playlists", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: import("@nestify/shared").UpdatePlaylistDto) =>
      apiFetch<Playlist>(`/api/playlists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/playlists/${id}`, {
        method: "DELETE",
      }),
    reorderTracks: (id: string, orderedIds: string[]) =>
      apiFetch<{ reordered: boolean }>(`/api/playlists/${id}/tracks/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ orderedIds }),
      }),
  },
  spotify: {
    myPlaylists: () =>
      apiFetch<SpotifySimplifiedPlaylist[]>("/api/spotify/me/playlists"),
    import: (spotifyPlaylistId: string, parentId?: string | null) =>
      apiFetch<Playlist>("/api/spotify/import", {
        method: "POST",
        body: JSON.stringify({ spotifyPlaylistId, parentId: parentId ?? null }),
      }),
    export: (playlistId: string) =>
      apiFetch<{ spotifyPlaylistId: string; url: string }>(
        `/api/spotify/export/${playlistId}`,
        { method: "POST" },
      ),
  },
};
