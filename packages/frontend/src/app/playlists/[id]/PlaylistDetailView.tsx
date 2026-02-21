"use client";

import { Play, Shuffle, Music2, Clock } from "lucide-react";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { usePlaylistTracks } from "@/hooks/usePlaylistTracks";
import { usePlayerStore } from "@/stores/playerStore";
import type { Playlist, SpotifyTrack } from "@nestify/shared";

interface Props {
  id: string;
}

function findPlaylistById(
  playlists: Playlist[],
  id: string,
): Playlist | undefined {
  for (const p of playlists) {
    if (p.id === id) return p;
    if (p.children) {
      const found = findPlaylistById(p.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlaylistDetailView({ id }: Props) {
  const { data: playlists } = usePlaylistTree();
  const { data: tracks, isLoading, isError } = usePlaylistTracks(id);
  const { playPlaylist, currentTrack, sourcePlaylistId } = usePlayerStore();

  const playlist = playlists ? findPlaylistById(playlists, id) : undefined;

  const handlePlay = async (includeChildren: boolean, shuffle: boolean) => {
    if (!tracks) return;
    const spotifyTracks: SpotifyTrack[] = tracks
      .filter((t) => t.track)
      .map((t) => t.track!);
    await playPlaylist(id, spotifyTracks, { includeChildren, shuffle });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-accent-pink text-sm py-8 text-center">
        トラックの読み込みに失敗しました
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start gap-4">
        <div
          className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl shrink-0"
          style={{ background: playlist?.color }}
        >
          {playlist?.icon ?? "🎵"}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold truncate">
            {playlist?.name ?? "プレイリスト"}
          </h1>
          <p className="text-foreground/50 text-sm mt-1 font-[family-name:var(--font-space-mono)]">
            {tracks?.length ?? 0} 曲
            {sourcePlaylistId === id && " · 再生中"}
          </p>

          {/* 再生ボタン */}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => handlePlay(true, false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent-purple text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Play size={16} />
              すべて再生
            </button>
            <button
              type="button"
              onClick={() => handlePlay(true, true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-foreground/80 text-sm hover:bg-white/5 transition-colors"
            >
              <Shuffle size={16} />
              シャッフル
            </button>
          </div>
        </div>
      </div>

      {/* トラックリスト */}
      {tracks && tracks.length > 0 ? (
        <div>
          {/* ヘッダー行 */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-3 py-2 text-foreground/30 text-xs border-b border-white/5">
            <span className="w-6 text-center">#</span>
            <span>タイトル</span>
            <span className="flex items-center">
              <Clock size={12} />
            </span>
          </div>

          {/* トラック行 */}
          <ul className="mt-1">
            {tracks.map((t, i) => {
              const isCurrentTrack = currentTrack?.id === t.track?.id;
              return (
                <li
                  key={t.id}
                  className={[
                    "grid grid-cols-[auto_1fr_auto] gap-4 px-3 py-2 rounded-md items-center hover:bg-white/5 transition-colors cursor-pointer",
                    isCurrentTrack ? "text-accent-purple" : "",
                  ].join(" ")}
                >
                  <span className="w-6 text-center text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
                    {isCurrentTrack ? (
                      <Music2 size={12} className="text-accent-purple mx-auto" />
                    ) : (
                      i + 1
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.track?.name ?? t.spotifyTrackId}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs text-foreground/50 truncate">
                        {t.track?.artists.join(", ")}
                      </p>
                      {/* 継承バッジ */}
                      {t.sourcePlaylistName !== playlist?.name && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple/70">
                          継承 · {t.sourcePlaylistName}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
                    {t.track ? formatDuration(t.track.durationMs) : "--:--"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-foreground/30 text-sm">曲がありません</p>
          <p className="text-foreground/20 text-xs mt-1">
            Spotify から曲を追加してください
          </p>
        </div>
      )}
    </div>
  );
}
