import { create } from "zustand";
import type { SpotifyTrack } from "@nestify/shared";
import { startPlayback } from "@/lib/spotify";

interface PlayerStore {
  currentTrack: SpotifyTrack | null;
  queue: SpotifyTrack[];
  queueIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  sourcePlaylistId: string | null;

  // アクション
  playPlaylist: (
    playlistId: string,
    tracks: SpotifyTrack[],
    options: { includeChildren: boolean; shuffle: boolean },
  ) => Promise<void>;
  playTrack: (track: SpotifyTrack, queue?: SpotifyTrack[]) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  setIsPlaying: (playing: boolean) => void;
}

/** Fisher-Yates シャッフル（immutable） */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  shuffle: false,
  sourcePlaylistId: null,

  playPlaylist: async (playlistId, tracks, { shuffle }) => {
    const orderedTracks = shuffle ? shuffleArray(tracks) : tracks;
    const first = orderedTracks[0] ?? null;

    set({
      queue: orderedTracks,
      queueIndex: 0,
      currentTrack: first,
      isPlaying: first !== null,
      sourcePlaylistId: playlistId,
    });

    // Spotify Connect API でトラックを再生
    const token = localStorage.getItem("nestify_token");
    if (token && orderedTracks.length > 0) {
      const uris = orderedTracks.map((t) => `spotify:track:${t.id}`);
      await startPlayback(uris, token);
    }
  },

  playTrack: (track, queue) => {
    const currentQueue = queue ?? get().queue;
    const index = currentQueue.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: currentQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
    });
  },

  next: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;
    const nextIndex = (queueIndex + 1) % queue.length;
    set({
      queueIndex: nextIndex,
      currentTrack: queue[nextIndex],
      isPlaying: true,
    });
  },

  prev: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;
    const prevIndex = (queueIndex - 1 + queue.length) % queue.length;
    set({
      queueIndex: prevIndex,
      currentTrack: queue[prevIndex],
      isPlaying: true,
    });
  },

  toggleShuffle: () => {
    const { shuffle, queue, currentTrack } = get();
    const newShuffle = !shuffle;

    if (newShuffle && currentTrack) {
      // シャッフル ON: 現在のトラックを先頭に残してシャッフル
      const rest = queue.filter((t) => t.id !== currentTrack.id);
      const shuffled = shuffleArray(rest);
      set({
        shuffle: newShuffle,
        queue: [currentTrack, ...shuffled],
        queueIndex: 0,
      });
    } else {
      set({ shuffle: newShuffle });
    }
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));
