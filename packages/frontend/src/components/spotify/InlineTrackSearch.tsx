"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Search, Plus, Check, Music2, Loader2, ChevronLeft, Disc3 } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api";
import type { SpotifyAlbum } from "@/lib/api";
import type { Playlist, SpotifyTrack } from "@nestify/shared";

interface Props {
  playlistId: string;
  playlist?: Playlist;
}

type Tab = "track" | "album";

function collectDescendants(pl: Playlist): Playlist[] {
  return [pl, ...(pl.children ?? []).flatMap(collectDescendants)];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export function InlineTrackSearch({ playlistId, playlist }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("track");
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbum | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState(playlistId);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // タブ切り替え時にドリルダウンをリセット
  useEffect(() => {
    setSelectedAlbum(null);
  }, [activeTab]);

  // クエリが空になったらドリルダウンもリセット
  useEffect(() => {
    if (query.length === 0) setSelectedAlbum(null);
  }, [query]);

  // 枠外クリックで結果パネルを閉じる
  const handleClose = useCallback(() => setQuery(""), []);
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [handleClose]);

  // ── トラック検索 ──────────────────────────────────────────────────────────

  const {
    data: tracks,
    isFetching: isFetchingTracks,
    isError: isTrackError,
    error: trackError,
  } = useQuery<SpotifyTrack[], Error>({
    queryKey: ["spotify-search", debouncedQuery],
    queryFn: async () => {
      const result = await api.spotify.search(debouncedQuery);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: debouncedQuery.length > 0 && activeTab === "track",
    staleTime: 30_000,
    retry: 1,
  });

  // ── アルバム検索 ──────────────────────────────────────────────────────────

  const {
    data: albums,
    isFetching: isFetchingAlbums,
    isError: isAlbumError,
    error: albumError,
  } = useQuery<SpotifyAlbum[], Error>({
    queryKey: ["spotify-album-search", debouncedQuery],
    queryFn: async () => {
      const result = await api.spotify.albumSearch(debouncedQuery);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: debouncedQuery.length > 0 && activeTab === "album" && !selectedAlbum,
    staleTime: 30_000,
    retry: 1,
  });

  // ── アルバム内トラック取得（ドリルダウン） ────────────────────────────────

  const {
    data: albumDetail,
    isFetching: isFetchingAlbumTracks,
    isError: isAlbumTracksError,
  } = useQuery<{ album: SpotifyAlbum; tracks: SpotifyTrack[] }, Error>({
    queryKey: ["spotify-album-tracks", selectedAlbum?.id],
    queryFn: async () => {
      const result = await api.spotify.albumTracks(selectedAlbum!.id);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!selectedAlbum,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // ── 単曲追加 ─────────────────────────────────────────────────────────────

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

  // ── 全曲追加 ─────────────────────────────────────────────────────────────

  const handleAddAll = async () => {
    if (!albumDetail || isAddingAll) return;
    setIsAddingAll(true);
    setAddError(null);

    const toAdd = albumDetail.tracks.filter((t) => !addedIds.has(t.id));
    const newIds = new Set(addedIds);
    let failed = 0;

    // MAX(order) の競合を避けるため直列で追加する
    // per-item try/catch でネットワークエラー時もループを継続し setIsAddingAll(false) を保証する
    for (const t of toAdd) {
      try {
        const res = await api.playlists.addTrack(targetPlaylistId, t.id, t);
        if (res.ok) {
          newIds.add(t.id);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setAddedIds(newIds);
    setIsAddingAll(false);
    queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    if (failed > 0) {
      setAddError(`${failed} 曲の追加に失敗しました。`);
    }
  };

  const isFetching =
    (activeTab === "track" && isFetchingTracks) ||
    (activeTab === "album" && !selectedAlbum && isFetchingAlbums) ||
    (activeTab === "album" && !!selectedAlbum && isFetchingAlbumTracks);

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="mb-4">
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
          placeholder="曲・アルバムを検索して追加..."
          aria-label="曲・アルバムを検索"
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
          {/* ── タブ ── */}
          <div
            className="flex"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["track", "album"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors duration-150"
                style={{
                  color: activeTab === tab ? "#7c6af7" : "rgba(255,255,255,0.35)",
                  borderBottom: activeTab === tab
                    ? "2px solid #7c6af7"
                    : "2px solid transparent",
                  background: activeTab === tab
                    ? "rgba(124,106,247,0.04)"
                    : "transparent",
                }}
              >
                {tab === "track" ? (
                  <><Music2 size={12} />曲</>
                ) : (
                  <><Disc3 size={12} />アルバム</>
                )}
              </button>
            ))}
          </div>

          {/* ── 追加先セレクト（子孫PLがある場合） ── */}
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

          {/* ── 曲タブ ── */}
          {activeTab === "track" && (
            <TrackPanel
              query={debouncedQuery}
              tracks={tracks}
              isFetching={isFetchingTracks}
              isError={isTrackError}
              error={trackError}
              addedIds={addedIds}
              isAdding={isAdding}
              onAdd={handleAdd}
            />
          )}

          {/* ── アルバムタブ: 一覧 ── */}
          {activeTab === "album" && !selectedAlbum && (
            <AlbumListPanel
              query={debouncedQuery}
              albums={albums}
              isFetching={isFetchingAlbums}
              isError={isAlbumError}
              error={albumError}
              onSelect={setSelectedAlbum}
            />
          )}

          {/* ── アルバムタブ: ドリルダウン ── */}
          {activeTab === "album" && selectedAlbum && (
            <AlbumDrilldown
              album={selectedAlbum}
              tracks={albumDetail?.tracks}
              isFetching={isFetchingAlbumTracks}
              isError={isAlbumTracksError}
              addedIds={addedIds}
              isAdding={isAdding}
              isAddingAll={isAddingAll}
              onBack={() => setSelectedAlbum(null)}
              onAdd={handleAdd}
              onAddAll={handleAddAll}
            />
          )}

          {/* ── フッター ── */}
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

// ---------------------------------------------------------------------------
// 曲タブパネル
// ---------------------------------------------------------------------------

interface TrackPanelProps {
  query: string;
  tracks: SpotifyTrack[] | undefined;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  addedIds: Set<string>;
  isAdding: boolean;
  onAdd: (track: SpotifyTrack) => void;
}

function TrackPanel({
  query,
  tracks,
  isFetching,
  isError,
  error,
  addedIds,
  isAdding,
  onAdd,
}: TrackPanelProps) {
  return (
    <div className="max-h-64 overflow-y-auto">
      {query.length === 0 && (
        <EmptyHint icon={<Music2 size={16} />} text="入力して検索..." />
      )}
      {isError && (
        <ErrorHint message={
          error?.message?.includes("503")
            ? "Spotify 連携が無効です。"
            : "検索に失敗しました。"
        } />
      )}
      {!isFetching && query.length > 0 && (tracks?.length ?? 0) === 0 && !isError && (
        <EmptyHint text={`「${query}」に一致する曲が見つかりませんでした`} />
      )}
      {(tracks?.length ?? 0) > 0 && (
        <ul className="p-2">
          {tracks!.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              added={addedIds.has(track.id)}
              disabled={isAdding}
              onAdd={() => onAdd(track)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// アルバム一覧パネル
// ---------------------------------------------------------------------------

interface AlbumListPanelProps {
  query: string;
  albums: SpotifyAlbum[] | undefined;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onSelect: (album: SpotifyAlbum) => void;
}

function AlbumListPanel({
  query,
  albums,
  isFetching,
  isError,
  error,
  onSelect,
}: AlbumListPanelProps) {
  return (
    <div className="max-h-64 overflow-y-auto">
      {query.length === 0 && (
        <EmptyHint icon={<Disc3 size={16} />} text="入力して検索..." />
      )}
      {isError && (
        <ErrorHint message={
          error?.message?.includes("503")
            ? "Spotify 連携が無効です。"
            : "検索に失敗しました。"
        } />
      )}
      {!isFetching && query.length > 0 && (albums?.length ?? 0) === 0 && !isError && (
        <EmptyHint text={`「${query}」に一致するアルバムが見つかりませんでした`} />
      )}
      {(albums?.length ?? 0) > 0 && (
        <ul className="p-2">
          {albums!.map((album) => (
            <li
              key={album.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => onSelect(album)}
            >
              {/* アルバムアート */}
              <div className="relative w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5">
                {album.imageUrl ? (
                  <Image
                    src={album.imageUrl}
                    alt={album.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <Disc3 size={16} className="m-auto mt-3 text-foreground/20" />
                )}
              </div>

              {/* アルバム情報 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{album.name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {album.artists.join(", ")}
                  <span style={{ color: "rgba(255,255,255,0.22)" }}>
                    {" "}· {album.releaseDate.slice(0, 4)}
                  </span>
                </p>
              </div>

              {/* 曲数 */}
              <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.22)" }}>
                {album.totalTracks}曲
              </span>

              {/* シェブロン */}
              <span
                className="text-xs shrink-0 transition-colors"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                ›
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// アルバムドリルダウン
// ---------------------------------------------------------------------------

interface AlbumDrilldownProps {
  album: SpotifyAlbum;
  tracks: SpotifyTrack[] | undefined;
  isFetching: boolean;
  isError: boolean;
  addedIds: Set<string>;
  isAdding: boolean;
  isAddingAll: boolean;
  onBack: () => void;
  onAdd: (track: SpotifyTrack) => void;
  onAddAll: () => void;
}

function AlbumDrilldown({
  album,
  tracks,
  isFetching,
  isError,
  addedIds,
  isAdding,
  isAddingAll,
  onBack,
  onAdd,
  onAddAll,
}: AlbumDrilldownProps) {
  const allAdded = (tracks?.length ?? 0) > 0 && tracks!.every((t) => addedIds.has(t.id));

  return (
    <>
      {/* ドリルダウンヘッダー */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.4)", background: "transparent" }}
          aria-label="アルバム一覧に戻る"
        >
          <ChevronLeft size={13} />
          戻る
        </button>

        {/* アルバムアート */}
        <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden bg-white/5">
          {album.imageUrl ? (
            <Image
              src={album.imageUrl}
              alt={album.name}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <Disc3 size={12} className="m-auto mt-2 text-foreground/20" />
          )}
        </div>

        {/* アルバム名 */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
            {album.name}
          </p>
          <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
            {album.artists.join(", ")} · {album.totalTracks}曲
          </p>
        </div>

        {/* 全曲追加ボタン */}
        <button
          type="button"
          onClick={onAddAll}
          disabled={isAddingAll || allAdded || isFetching}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0"
          style={{
            background: allAdded ? "rgba(106,247,200,0.12)" : "rgba(124,106,247,0.15)",
            border: allAdded
              ? "1px solid rgba(106,247,200,0.3)"
              : "1px solid rgba(124,106,247,0.3)",
            color: allAdded ? "#6af7c8" : "#7c6af7",
            opacity: (isAddingAll || isFetching) ? 0.6 : 1,
          }}
        >
          {isAddingAll ? (
            <Loader2 size={11} className="animate-spin" />
          ) : allAdded ? (
            <Check size={11} />
          ) : (
            <Plus size={11} />
          )}
          {allAdded ? "追加済み" : "全曲追加"}
        </button>
      </div>

      {/* トラックリスト */}
      <div className="max-h-56 overflow-y-auto">
        {isFetching && (
          <div className="flex items-center justify-center gap-2 py-6" style={{ color: "rgba(255,255,255,0.25)" }}>
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">読み込み中...</span>
          </div>
        )}
        {isError && (
          <ErrorHint message="アルバムの取得に失敗しました。" />
        )}
        {!isFetching && !isError && (tracks?.length ?? 0) > 0 && (
          <ul className="p-2">
            {tracks!.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                added={addedIds.has(track.id)}
                disabled={isAdding || isAddingAll}
                onAdd={() => onAdd(track)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 共通サブコンポーネント
// ---------------------------------------------------------------------------

interface TrackRowProps {
  track: SpotifyTrack;
  index?: number;
  added: boolean;
  disabled: boolean;
  onAdd: () => void;
}

function TrackRow({ track, index, added, disabled, onAdd }: TrackRowProps) {
  return (
    <li
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
      onClick={(e) => {
        // ボタン・アンカー等のインタラクティブ要素のクリックは伝播させない
        if ((e.target as HTMLElement).closest("button, a")) return;
        if (!added && !disabled) onAdd();
      }}
    >
      {index !== undefined && (
        <span
          className="text-xs w-4 text-center shrink-0 font-[family-name:var(--font-space-mono)]"
          style={{ color: "rgba(255,255,255,0.18)" }}
        >
          {index + 1}
        </span>
      )}
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
          {track.album && index === undefined && (
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
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        disabled={added || disabled}
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
}

function EmptyHint({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6" style={{ color: "rgba(255,255,255,0.25)" }}>
      {icon}
      <p className="text-xs">{text}</p>
    </div>
  );
}

function ErrorHint({ message }: { message: string }) {
  return (
    <div className="text-center py-5">
      <p className="text-xs" style={{ color: "#f76a8a" }}>{message}</p>
    </div>
  );
}
