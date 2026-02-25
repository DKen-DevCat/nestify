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

export function InlineTrackSearch({ playlistId, playlist }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState(playlistId);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const isExpanded = query.length > 0;

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

  // 追加先が変わったら addedIds・エラーをリセット
  useEffect(() => {
    setAddedIds(new Set());
    setAddError(null);
  }, [targetPlaylistId]);

  // playlistId が変わったら追加先をリセット
  useEffect(() => {
    setTargetPlaylistId(playlistId);
  }, [playlistId]);

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
    setAddError(null);
    const res = await api.playlists.addTrack(targetPlaylistId, track.id, track);
    setIsAdding(false);
    if (res.ok) {
      setAddedIds((prev) => new Set(prev).add(track.id));
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    } else {
      setAddError("追加に失敗しました。再度お試しください。");
    }
  };

  return (
    <div className="mb-4">
      {/* ─── 常時表示の検索バー ─── */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 transition-colors duration-150"
        style={{
          background: isExpanded
            ? "rgba(124,106,247,0.04)"
            : "rgba(255,255,255,0.02)",
          borderBottom: isExpanded
            ? "1px solid rgba(124,106,247,0.2)"
            : "1px solid rgba(255,255,255,0.04)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <Search
          size={14}
          style={{
            color: isExpanded ? "#7c6af7" : "rgba(255,255,255,0.22)",
            transition: "color 0.15s",
            flexShrink: 0,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="曲を検索して追加..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{
            color: isExpanded ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
          }}
        />
        {isFetching && (
          <Loader2
            size={13}
            className="animate-spin shrink-0"
            style={{ color: "rgba(255,255,255,0.25)" }}
          />
        )}
        {isExpanded && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-0.5 rounded transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            aria-label="検索をクリア"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ─── 結果パネル（入力後のみ表示） ─── */}
      {isExpanded && (
        <div
          className="animate-fade-in"
          style={{
            border: "1px solid rgba(124,106,247,0.18)",
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            background: "rgba(12,11,22,0.98)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {/* 追加先選択（子孫プレイリストが存在する場合のみ） */}
          {descendants.length > 1 && (
            <div
              className="px-4 py-2 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                追加先:
              </span>
              <select
                value={targetPlaylistId}
                onChange={(e) => setTargetPlaylistId(e.target.value)}
                className="flex-1 text-xs rounded px-2 py-1 outline-none cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)",
                }}
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
          <div className="max-h-64 overflow-y-auto">
            {/* 入力中・未確定 */}
            {debouncedQuery.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-foreground/25">
                <Music2 size={16} />
                <p className="text-xs">入力して検索...</p>
              </div>
            )}

            {/* エラー */}
            {isError && (
              <div className="text-center py-5">
                <p className="text-xs" style={{ color: "#f76a8a" }}>
                  {error?.message?.includes("503")
                    ? "Spotify 連携が無効です。管理者にお問い合わせください。"
                    : "検索に失敗しました。再度お試しください。"}
                </p>
              </div>
            )}

            {/* 結果なし */}
            {!isFetching &&
              debouncedQuery.length > 0 &&
              (tracks?.length ?? 0) === 0 &&
              !isError && (
                <p className="text-xs text-center py-5" style={{ color: "rgba(255,255,255,0.25)" }}>
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
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      {/* アルバムアート */}
                      <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden bg-white/5">
                        {track.imageUrl ? (
                          <Image
                            src={track.imageUrl}
                            alt={track.album}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <Music2 size={12} className="m-auto mt-2 text-foreground/20" />
                        )}
                      </div>

                      {/* 曲名 + アーティスト */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {track.artists.join(", ")}
                          {track.album && (
                            <span style={{ color: "rgba(255,255,255,0.25)" }}> · {track.album}</span>
                          )}
                        </p>
                      </div>

                      {/* 再生時間 */}
                      <span
                        className="text-xs shrink-0 font-[family-name:var(--font-space-mono)]"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        {formatDuration(track.durationMs)}
                      </span>

                      {/* 追加ボタン */}
                      <button
                        type="button"
                        onClick={() => handleAdd(track)}
                        disabled={added || isAdding}
                        className={[
                          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          added
                            ? "bg-accent-green/20 text-accent-green"
                            : "bg-white/5 text-foreground/50 hover:bg-accent-purple/20 hover:text-accent-purple opacity-0 group-hover:opacity-100",
                          "disabled:cursor-default",
                        ].join(" ")}
                        aria-label={added ? "追加済み" : "追加"}
                      >
                        {added ? <Check size={12} /> : <Plus size={12} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* フッター: 追加済み曲数 / エラー */}
          {(addedIds.size > 0 || addError) && (
            <div
              className="px-4 py-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              {addError ? (
                <p className="text-xs text-center" style={{ color: "#f76a8a" }}>{addError}</p>
              ) : (
                <p className="text-xs text-center" style={{ color: "#6af7c8" }}>
                  {addedIds.size} 曲を追加しました
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
