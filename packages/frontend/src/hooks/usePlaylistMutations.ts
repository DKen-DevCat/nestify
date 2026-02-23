import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreatePlaylistDto, UpdatePlaylistDto } from "@nestify/shared";

export function useCreatePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreatePlaylistDto) => api.playlists.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useUpdatePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePlaylistDto }) =>
      api.playlists.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.playlists.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    },
  });
}

export function useReorderItems(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Array<{ type: "track" | "playlist"; id: string }>) =>
      api.playlists.reorderItems(playlistId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    },
  });
}

export function useReorderTracks(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.playlists.reorderTracks(playlistId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", playlistId],
      });
    },
  });
}

export function useAddTrack(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (spotifyTrackId: string) =>
      api.playlists.addTrack(playlistId, spotifyTrackId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", playlistId],
      });
    },
  });
}

export function useMoveTrack(sourcePlaylistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      trackId,
      targetPlaylistId,
      order,
    }: {
      trackId: string;
      targetPlaylistId: string;
      order?: number;
    }) => api.playlists.moveTrack(sourcePlaylistId, trackId, targetPlaylistId, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    },
  });
}
