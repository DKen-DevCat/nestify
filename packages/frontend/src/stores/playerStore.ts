import { create } from "zustand";
import type { SpotifyTrack } from "@nestify/shared";

interface PlayerStore {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  sourcePlaylistId: string | null;
  includeChildren: boolean;

  playTrack: (track: SpotifyTrack, playlistId: string) => void;
  stopPlayback: () => void;
  toggleIncludeChildren: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrack: null,
  isPlaying: false,
  sourcePlaylistId: null,
  includeChildren: true,

  playTrack: (track, playlistId) =>
    set({ currentTrack: track, isPlaying: true, sourcePlaylistId: playlistId }),

  stopPlayback: () => set({ isPlaying: false, currentTrack: null }),

  toggleIncludeChildren: () =>
    set((state) => ({ includeChildren: !state.includeChildren })),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));
