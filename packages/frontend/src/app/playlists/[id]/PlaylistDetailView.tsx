"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Play,
  Shuffle,
  Music2,
  Clock,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  GripVertical,
  ListPlus,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { usePlaylistTracks } from "@/hooks/usePlaylistTracks";
import { usePlayerStore } from "@/stores/playerStore";
import {
  useDeletePlaylist,
  useReorderTracks,
  useUpdatePlaylist,
} from "@/hooks/usePlaylistMutations";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { AddTrackModal } from "@/components/spotify/AddTrackModal";
import { api } from "@/lib/api";
import type { Playlist, SpotifyTrack } from "@nestify/shared";
import type { TrackWithSource } from "@/lib/api";

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

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "--";
  }
}

// ---------------------------------------------------------------------------
// ソータブルなトラック行（直接追加のトラック用）
// ---------------------------------------------------------------------------

interface SortableTrackItemProps {
  track: TrackWithSource;
  index: number;
  currentTrackId: string | undefined;
}

function SortableTrackItem({
  track,
  index,
  currentTrackId,
}: SortableTrackItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isCurrentTrack = currentTrackId === track.track?.id;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "group grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-md items-center",
        "hover:bg-white/5 transition-colors cursor-pointer",
        isCurrentTrack ? "text-accent-purple" : "",
      ].join(" ")}
    >
      <span
        className="flex items-center justify-center text-foreground/20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={13} />
      </span>

      <span className="w-6 text-center text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {isCurrentTrack ? (
          <Music2 size={12} className="text-accent-purple mx-auto" />
        ) : (
          index + 1
        )}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded shrink-0 overflow-hidden bg-white/5">
          {track.track?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.track.imageUrl}
              alt={track.track.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={12} className="text-foreground/20" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {track.track?.name ?? track.spotifyTrackId}
          </p>
          <p className="text-xs text-foreground/50 truncate">
            {track.track?.artists.join(", ")}
          </p>
        </div>
      </div>

      <span className="text-foreground/40 text-xs truncate">
        {track.track?.album ?? "--"}
      </span>

      <span className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {formatDate(track.addedAt)}
      </span>

      <span className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {track.track ? formatDuration(track.track.durationMs) : "--:--"}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 非ソータブルなトラック行（子孫プレイリスト内のトラック用）
// ---------------------------------------------------------------------------

interface SimpleTrackItemProps {
  track: TrackWithSource;
  index: number;
  currentTrackId: string | undefined;
}

function SimpleTrackItem({
  track,
  index,
  currentTrackId,
}: SimpleTrackItemProps) {
  const isCurrentTrack = currentTrackId === track.track?.id;

  return (
    <li
      className={[
        "grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-1.5 rounded-md items-center",
        "hover:bg-white/5 transition-colors",
        isCurrentTrack ? "text-accent-purple" : "",
      ].join(" ")}
    >
      <span className="w-6 text-center text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {isCurrentTrack ? (
          <Music2 size={12} className="text-accent-purple mx-auto" />
        ) : (
          index + 1
        )}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-white/5">
          {track.track?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.track.imageUrl}
              alt={track.track.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={10} className="text-foreground/20" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {track.track?.name ?? track.spotifyTrackId}
          </p>
          <p className="text-xs text-foreground/50 truncate">
            {track.track?.artists.join(", ")}
          </p>
        </div>
      </div>

      <span className="text-foreground/40 text-xs truncate">
        {track.track?.album ?? "--"}
      </span>

      <span className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {track.track ? formatDuration(track.track.durationMs) : "--:--"}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 子孫プレイリストのセクション（再帰）
// ---------------------------------------------------------------------------

interface ChildPlaylistSectionProps {
  playlist: Playlist;
  tracksByPlaylist: Map<string, TrackWithSource[]>;
  depth: number;
  currentTrackId: string | undefined;
}

function ChildPlaylistSection({
  playlist,
  tracksByPlaylist,
  depth,
  currentTrackId,
}: ChildPlaylistSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const myTracks = tracksByPlaylist.get(playlist.id) ?? [];
  const hasContent =
    myTracks.length > 0 || (playlist.children ?? []).length > 0;
  const totalTracks = myTracks.length;

  return (
    <div
      className="mt-3"
      style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}
    >
      {/* セクションヘッダー */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-foreground/40 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-foreground/40 shrink-0" />
        )}
        {playlist.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-5 h-5 rounded shrink-0 object-cover"
          />
        ) : (
          <span className="text-base leading-none shrink-0">
            {playlist.icon}
          </span>
        )}
        <span className="text-sm font-medium truncate">{playlist.name}</span>
        <span className="ml-auto text-xs text-foreground/30 shrink-0 font-[family-name:var(--font-space-mono)]">
          {totalTracks}曲
        </span>
      </button>

      {/* コンテンツ（展開時） */}
      {expanded && hasContent && (
        <div className="mt-1 border-l border-white/10 ml-3.5 pl-3">
          {/* このプレイリストの直接のトラック */}
          {myTracks.length > 0 && (
            <ul className="space-y-0.5">
              {myTracks.map((t, i) => (
                <SimpleTrackItem
                  key={t.id}
                  track={t}
                  index={i}
                  currentTrackId={currentTrackId}
                />
              ))}
            </ul>
          )}

          {/* 子プレイリストを再帰表示 */}
          {(playlist.children ?? []).map((child) => (
            <ChildPlaylistSection
              key={child.id}
              playlist={child}
              tracksByPlaylist={tracksByPlaylist}
              depth={0}
              currentTrackId={currentTrackId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export function PlaylistDetailView({ id }: Props) {
  const router = useRouter();
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  // インライン名前変更
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // DnD 用のローカル順序（楽観的更新 — 直接のトラックのみ）
  const [localOwnTracks, setLocalOwnTracks] = useState<TrackWithSource[] | null>(null);

  const { data: playlists } = usePlaylistTree();
  const { data: tracks, isLoading, isError } = usePlaylistTracks(id);
  const { playPlaylist, currentTrack, sourcePlaylistId } = usePlayerStore();
  const { mutate: deletePlaylist, isPending: isDeleting } = useDeletePlaylist();
  const { mutate: reorderTracks } = useReorderTracks(id);
  const { mutate: updatePlaylist } = useUpdatePlaylist();

  const playlist = playlists ? findPlaylistById(playlists, id) : undefined;

  // サーバーデータが更新されたらローカル状態をリセット
  useEffect(() => {
    setLocalOwnTracks(null);
  }, [tracks]);

  // ルートの直接トラック（DnD 対象）
  const ownTracksFromServer = useMemo(
    () => tracks?.filter((t) => t.playlistId === id) ?? [],
    [tracks, id],
  );
  const ownTracks = localOwnTracks ?? ownTracksFromServer;

  // 全トラックを playlistId でグループ化（子セクション描画用）
  const tracksByPlaylist = useMemo(() => {
    const map = new Map<string, TrackWithSource[]>();
    for (const t of tracks ?? []) {
      const arr = map.get(t.playlistId) ?? [];
      arr.push(t);
      map.set(t.playlistId, arr);
    }
    return map;
  }, [tracks]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || ownTracks.length === 0) return;

    const oldIndex = ownTracks.findIndex((t) => t.id === String(active.id));
    const newIndex = ownTracks.findIndex((t) => t.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOwnTracks = arrayMove(ownTracks, oldIndex, newIndex);
    setLocalOwnTracks(newOwnTracks);

    reorderTracks(
      newOwnTracks.map((t) => t.id),
      { onError: () => setLocalOwnTracks(null) },
    );
  };

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

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== playlist?.name) {
      updatePlaylist({ id, dto: { name: trimmed } });
    }
    setIsRenaming(false);
  };

  const startRenaming = () => {
    setRenameValue(playlist?.name ?? "");
    setIsRenaming(true);
    // input は次の tick で DOM に現れるので setTimeout で focus
    setTimeout(() => renameInputRef.current?.focus(), 0);
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

  const hasOwnTracks = ownTracks.length > 0;
  const hasChildren = (playlist?.children ?? []).length > 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start gap-4">
        <div
          className="w-20 h-20 rounded-xl shrink-0 overflow-hidden"
          style={{
            background: playlist?.imageUrl
              ? undefined
              : (playlist?.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)"),
          }}
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
          {/* プレイリスト名（クリックでインライン編集） */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              className="font-[family-name:var(--font-syne)] text-2xl font-bold bg-transparent border-b border-accent-purple/50 outline-none w-full text-foreground"
            />
          ) : (
            <button
              type="button"
              onClick={startRenaming}
              title="クリックして名前を変更"
              className="group flex items-center gap-2 text-left w-full"
            >
              <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold truncate">
                {playlist?.name ?? "プレイリスト"}
              </h1>
              <Pencil
                size={14}
                className="text-foreground/20 group-hover:text-foreground/50 transition-colors shrink-0"
              />
            </button>
          )}

          <p className="text-foreground/50 text-sm mt-1 font-[family-name:var(--font-space-mono)]">
            {(tracks?.length ?? 0)} 曲
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
            <button
              type="button"
              onClick={() => setIsAddingTrack(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-foreground/80 text-sm hover:bg-white/5 transition-colors"
            >
              <ListPlus size={16} />
              曲を追加
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

      {/* ─── トラックリスト ─── */}
      {hasOwnTracks || hasChildren ? (
        <div>
          {/* 直接のトラック（ソータブル） */}
          {hasOwnTracks && (
            <div>
              <div className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 text-foreground/30 text-xs border-b border-white/5 mb-1">
                <span />
                <span className="w-6 text-center">#</span>
                <span>タイトル</span>
                <span>アルバム</span>
                <span>追加日</span>
                <span className="flex items-center justify-end">
                  <Clock size={12} />
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={ownTracks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul>
                    {ownTracks.map((t, i) => (
                      <SortableTrackItem
                        key={t.id}
                        track={t}
                        index={i}
                        currentTrackId={currentTrack?.id}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* 子孫プレイリスト（ツリー形式） */}
          {hasChildren && (
            <div className={hasOwnTracks ? "mt-4 border-t border-white/5 pt-4" : ""}>
              {(playlist?.children ?? []).map((child) => (
                <ChildPlaylistSection
                  key={child.id}
                  playlist={child}
                  tracksByPlaylist={tracksByPlaylist}
                  depth={0}
                  currentTrackId={currentTrack?.id}
                />
              ))}
            </div>
          )}
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

      {/* 曲を追加モーダル */}
      {isAddingTrack && (
        <AddTrackModal
          playlistId={id}
          onClose={() => setIsAddingTrack(false)}
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
