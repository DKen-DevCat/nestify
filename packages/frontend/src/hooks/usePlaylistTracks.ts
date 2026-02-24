import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrackWithSource } from "@/lib/api";

async function fetchPlaylistTracks(id: string): Promise<TrackWithSource[]> {
  const result = await api.playlists.tracks(id);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export function usePlaylistTracks(id: string) {
  return useQuery<TrackWithSource[], Error>({
    queryKey: ["playlist-tracks", id],
    queryFn: () => fetchPlaylistTracks(id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
