import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Playlist } from "@nestify/shared";

async function fetchPlaylistTree(): Promise<Playlist[]> {
  const result = await api.playlists.list();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export function usePlaylistTree() {
  return useQuery<Playlist[], Error>({
    queryKey: ["playlists"],
    queryFn: fetchPlaylistTree,
    staleTime: 30 * 1000,
  });
}
