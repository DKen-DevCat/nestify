import type { Playlist } from "@nestify/shared";

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
  },
};
