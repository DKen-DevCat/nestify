"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Play, Shuffle, Music2, Clock, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { usePlaylistTracks } from "@/hooks/usePlaylistTracks";
import { usePlayerStore } from "@/stores/playerStore";
import { useDeletePlaylist } from "@/hooks/usePlaylistMutations";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { api } from "@/lib/api";
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
  const router = useRouter();
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const { data: playlists } = usePlaylistTree();
  const { data: tracks, isLoading, isError } = usePlaylistTracks(id);
  const { playPlaylist, currentTrack, sourcePlaylistId } = usePlayerStore();
  const { mutate: deletePlaylist, isPending: isDeleting } = useDeletePlaylist();

  const { mutate: exportPlaylist, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const res = await api.spotify.export(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      setExportedUrl(data.url);
    },
  });

  const playlist = playlists ? findPlaylistById(playlists, id) : undefined;

  const handlePlay = async (includeChildren: boolean, shuffle: boolean) => {
    if (!tracks) return;
    const spotifyTracks: SpotifyTrack[] = tracks
      .filter((t) => t.track)
      .map((t) => t.track!);
    await playPlaylist(id, spotifyTracks, { includeChildren, shuffle });
  };

  const handleDelete = () => {
    deletePlaylist(id, {
      onSuccess: () => {
        router.push("/playlists");
      },
    });
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
          className="w-20 h-20 rounded-xl shrink-0 overflow-hidden"
          style={{ background: playlist?.imageUrl ? undefined : (playlist?.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)") }}
        >
          {playlist?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={playlist.imageUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-4xl">
              {playlist?.icon ?? "🎵"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold truncate">
            {playlist?.name ?? "プレイリスト"}
          </h1>
          <p className="text-foreground/50 text-sm mt-1 font-[family-name:var(--font-space-mono)]">
            {tracks?.length ?? 0} 曲
            {sourcePlaylistId === id && " · 再生中"}
          </p>

          {/* アクションボタン */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => handlePlay(true, false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #7c6af7, #f76a8a)" }}
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
            <button
              type="button"
              onClick={() => setIsAddingChild(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-foreground/80 text-sm hover:bg-white/5 transition-colors"
            >
              <Plus size={16} />
              サブPL
            </button>
            {exportedUrl ? (
              <a
                href={exportedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-accent-green/30 text-accent-green text-sm hover:bg-accent-green/10 transition-colors"
              >
                <ExternalLink size={14} />
                Spotify で開く
              </a>
            ) : (
              <button
                type="button"
                onClick={() => exportPlaylist()}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-foreground/80 text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Spotify へ書き出し
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-foreground/30 text-sm hover:text-accent-pink hover:bg-accent-pink/10 transition-colors ml-auto"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* トラックリスト */}
      {tracks && tracks.length > 0 ? (
        <div>
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-3 py-2 text-foreground/30 text-xs border-b border-white/5">
            <span className="w-6 text-center">#</span>
            <span>タイトル</span>
            <span className="flex items-center">
              <Clock size={12} />
            </span>
          </div>

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
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <p className="text-xs text-foreground/50 truncate">
                        {t.track?.artists.join(", ")}
                      </p>
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

      {/* サブプレイリスト作成モーダル */}
      {isAddingChild && (
        <CreatePlaylistModal
          parentId={id}
          onClose={() => setIsAddingChild(false)}
        />
      )}

      {/* 削除確認ダイアログ */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-xs mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-[family-name:var(--font-syne)] text-base font-bold mb-2">
              プレイリストを削除
            </h2>
            <p className="text-foreground/50 text-sm mb-5">
              「{playlist?.name}」を削除します。子プレイリストも含めて削除されます。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-foreground/60 hover:bg-white/5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-lg bg-accent-pink/20 text-accent-pink text-sm font-medium hover:bg-accent-pink/30 disabled:opacity-40 transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
