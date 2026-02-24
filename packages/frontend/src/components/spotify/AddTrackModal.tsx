"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Search, Plus, Check, Music2, Loader2 } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api";
import type { Playlist, SpotifyTrack } from "@nestify/shared";

interface Props {
  playlistId: string;
  playlist?: Playlist;
  onClose: () => void;
}

function collectDescendants(pl: Playlist): Playlist[] {
  return [pl, ...(pl.children ?? []).flatMap(collectDescendants)];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AddTrackModal({ playlistId, playlist, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState(playlistId);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const descendants = useMemo(
    () => (playlist ? collectDescendants(playlist) : []),
    [playlist],
  );

  // 入力から 400ms 後に検索クエリを確定
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // モーダル開いたら入力欄にフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const {
    data: tracks,
    isFetching,
    isError,
    error,
  } = useQuery<SpotifyTrack[], Error>({
    queryKey: ["spotify-search", debouncedQuery],
    queryFn: async () => {
      const result = await api.spotify.search(debouncedQuery);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
    retry: 1,
  });

  const handleAdd = async (track: SpotifyTrack) => {
    if (addedIds.has(track.id) || isAdding) return;
    setIsAdding(true);
    const res = await api.playlists.addTrack(targetPlaylistId, track.id, track);
    setIsAdding(false);
    if (res.ok) {
      setAddedIds((prev) => new Set(prev).add(track.id));
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl flex flex-col max-h-[80vh] animate-fade-in-up"
        style={{
          background: "rgba(10, 9, 20, 0.98)",
          border: "1px solid rgba(124,106,247,0.2)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-[family-name:var(--font-syne)] text-base font-bold">
            曲を追加
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-foreground/50 hover:text-foreground transition-colors"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        {/* 検索入力 */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
            <Search size={15} className="text-foreground/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="曲名・アーティスト名で検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
            />
            {isFetching && (
              <Loader2 size={14} className="text-foreground/30 animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* 追加先選択 */}
        {descendants.length > 1 && (
          <div className="px-5 py-2 border-b border-white/5 flex items-center gap-2">
            <span className="text-xs text-foreground/40 shrink-0">追加先:</span>
            <select
              value={targetPlaylistId}
              onChange={(e) => setTargetPlaylistId(e.target.value)}
              className="flex-1 bg-white/5 text-xs text-foreground/80 rounded px-2 py-1 outline-none border border-white/10 cursor-pointer"
            >
              {descendants.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#141414]">
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 検索結果 */}
        <div className="flex-1 overflow-y-auto">
          {/* 未検索状態 */}
          {debouncedQuery.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-foreground/30">
              <Music2 size={32} className="mb-3 opacity-50" />
              <p className="text-sm">Spotifyで曲を検索</p>
            </div>
          )}

          {/* エラー */}
          {isError && (
            <div className="text-center py-8">
              <p className="text-accent-pink text-xs">
                {error?.message?.includes("503")
                  ? "Spotify 連携が無効です。管理者にお問い合わせください。"
                  : "検索に失敗しました。再度お試しください。"}
              </p>
              <p className="text-foreground/20 text-xs mt-1">{error?.message}</p>
            </div>
          )}

          {/* 結果なし */}
          {!isFetching && debouncedQuery.length > 0 && (tracks?.length ?? 0) === 0 && !isError && (
            <p className="text-foreground/30 text-sm text-center py-8">
              「{debouncedQuery}」に一致する曲が見つかりませんでした
            </p>
          )}

          {/* トラックリスト */}
          {(tracks?.length ?? 0) > 0 && (
            <ul className="p-2">
              {tracks!.map((track) => {
                const added = addedIds.has(track.id);
                return (
                  <li
                    key={track.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    {/* アルバムアート */}
                    <div className="relative w-9 h-9 rounded shrink-0 overflow-hidden bg-white/5">
                      {track.imageUrl ? (
                        <Image
                          src={track.imageUrl}
                          alt={track.album}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <Music2 size={14} className="m-auto mt-2.5 text-foreground/20" />
                      )}
                    </div>

                    {/* 曲名 + アーティスト */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <p className="text-xs text-foreground/50 truncate">
                        {track.artists.join(", ")}
                        {track.album && (
                          <span className="text-foreground/30"> · {track.album}</span>
                        )}
                      </p>
                    </div>

                    {/* 再生時間 */}
                    <span className="text-xs text-foreground/30 font-[family-name:var(--font-space-mono)] shrink-0">
                      {formatDuration(track.durationMs)}
                    </span>

                    {/* 追加ボタン */}
                    <button
                      type="button"
                      onClick={() => handleAdd(track)}
                      disabled={added || isAdding}
                      className={[
                        "shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                        added
                          ? "bg-accent-green/20 text-accent-green"
                          : "bg-white/5 text-foreground/50 hover:bg-accent-purple/20 hover:text-accent-purple opacity-0 group-hover:opacity-100",
                        "disabled:cursor-default",
                      ].join(" ")}
                      aria-label={added ? "追加済み" : "追加"}
                    >
                      {added ? <Check size={13} /> : <Plus size={13} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* フッター */}
        {addedIds.size > 0 && (
          <div className="px-5 py-3 border-t border-white/5">
            <p className="text-xs text-accent-green text-center">
              {addedIds.size} 曲を追加しました
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
