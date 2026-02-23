"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
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
import {
  useDeletePlaylist,
  useUpdatePlaylist,
} from "@/hooks/usePlaylistMutations";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { AddTrackModal } from "@/components/spotify/AddTrackModal";
import { api } from "@/lib/api";
import type { Playlist } from "@nestify/shared";
import type { TrackWithSource } from "@/lib/api";

interface Props {
  id: string;
}

// ---------------------------------------------------------------------------
// 型定義・ヘルパー
// ---------------------------------------------------------------------------

type MixedItem =
  | { kind: "track"; item: TrackWithSource }
  | { kind: "playlist"; item: Playlist };

function buildMixedList(
  tracks: TrackWithSource[],
  children: Playlist[],
): MixedItem[] {
  return [
    ...tracks.map((t) => ({ kind: "track" as const, item: t })),
    ...children.map((p) => ({ kind: "playlist" as const, item: p })),
  ].sort((a, b) => a.item.order - b.item.order);
}

function countTracksInPlaylist(
  playlist: Playlist,
  tracksByPlaylist: Map<string, TrackWithSource[]>,
): number {
  const directCount = tracksByPlaylist.get(playlist.id)?.length ?? 0;
  const childrenCount = (playlist.children ?? []).reduce(
    (sum, child) => sum + countTracksInPlaylist(child, tracksByPlaylist),
    0,
  );
  return directCount + childrenCount;
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
// Detail DnD Context（単一 DndContext 内でコンテナ情報を共有）
// ---------------------------------------------------------------------------

interface DetailDndCtxValue {
  /** trackId → playlistId のマッピング */
  trackToContainer: Map<string, string>;
  /** playlistId → MixedItem[] のローカル表示状態 */
  containerItems: Record<string, MixedItem[]>;
}

const DetailDndCtx = createContext<DetailDndCtxValue>({
  trackToContainer: new Map(),
  containerItems: {},
});

// ---------------------------------------------------------------------------
// ソータブルなトラック行
// ---------------------------------------------------------------------------

interface SortableTrackItemProps {
  track: TrackWithSource;
  index: number;
}

function SortableTrackItem({ track, index }: SortableTrackItemProps) {
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-md items-center hover:bg-white/5 transition-colors cursor-pointer"
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
        {index + 1}
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
// DragOverlay 用トラック行（ドラッグ中の見た目）
// ---------------------------------------------------------------------------

function DragOverlayTrackItem({ track }: { track: TrackWithSource }) {
  return (
    <div className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-md items-center bg-[#1e1e1e] border border-accent-purple/30 shadow-xl opacity-90">
      <span className="flex items-center justify-center text-foreground/40">
        <GripVertical size={13} />
      </span>
      <span className="w-6" />
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
      <span />
      <span className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {track.track ? formatDuration(track.track.durationMs) : "--:--"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 非ソータブルなトラック行（子プレイリスト内のトラック用）
// ---------------------------------------------------------------------------

function SimpleTrackItem({ track, index }: { track: TrackWithSource; index: number }) {
  return (
    <li className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-1.5 rounded-md items-center hover:bg-white/5 transition-colors">
      <span className="w-6 text-center text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
        {index + 1}
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
// SortablePlaylistSection（子プレイリストのソータブルセクション）
// ---------------------------------------------------------------------------

interface SortablePlaylistSectionProps {
  playlist: Playlist;
  tracksByPlaylist: Map<string, TrackWithSource[]>;
}

function SortablePlaylistSection({
  playlist,
  tracksByPlaylist,
}: SortablePlaylistSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { mutate: updatePlaylist } = useUpdatePlaylist();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlist.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const directChildren = playlist.children ?? [];
  const totalTracks = countTracksInPlaylist(playlist, tracksByPlaylist);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== playlist.name) {
      updatePlaylist({ id: playlist.id, dto: { name: trimmed } });
    }
    setIsRenaming(false);
  };

  const startRenaming = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(playlist.name);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors mt-1">
        <span
          className="text-foreground/20 hover:text-foreground/40 cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-foreground/40 shrink-0"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {playlist.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-5 h-5 rounded shrink-0 object-cover"
          />
        ) : (
          <span className="text-base leading-none shrink-0">{playlist.icon}</span>
        )}
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
            className="text-sm font-medium bg-transparent border-b border-accent-purple/50 outline-none flex-1 text-foreground min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm font-medium truncate flex-1">{playlist.name}</span>
        )}
        {!isRenaming && (
          <button
            type="button"
            onClick={startRenaming}
            className="text-foreground/20 hover:text-foreground/50 transition-colors shrink-0"
          >
            <Pencil size={12} />
          </button>
        )}
        <span className="text-xs text-foreground/30 font-[family-name:var(--font-space-mono)] shrink-0">
          {totalTracks}曲
        </span>
      </div>

      {expanded && (
        <div className="border-l border-white/10 ml-3.5 pl-3 mt-1">
          <PlaylistLevelContent
            playlistId={playlist.id}
            directChildren={directChildren}
            tracksByPlaylist={tracksByPlaylist}
          />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// PlaylistLevelContent（1階層の混在DnDリスト）
// ---------------------------------------------------------------------------

interface PlaylistLevelContentProps {
  playlistId: string;
  directChildren: Playlist[];
  tracksByPlaylist: Map<string, TrackWithSource[]>;
}

function PlaylistLevelContent({
  playlistId,
  directChildren,
  tracksByPlaylist,
}: PlaylistLevelContentProps) {
  const { containerItems } = useContext(DetailDndCtx);
  const { setNodeRef } = useDroppable({ id: playlistId });

  const displayMixed = containerItems[playlistId] ?? [];

  if (displayMixed.length === 0) return null;

  return (
    <SortableContext
      items={displayMixed.map((m) => m.item.id)}
      strategy={verticalListSortingStrategy}
    >
      <ul ref={setNodeRef} className="space-y-0.5 min-h-[4px]">
        {displayMixed.map((m, i) =>
          m.kind === "track" ? (
            <SortableTrackItem
              key={m.item.id}
              track={m.item}
              index={i}
            />
          ) : (
            <SortablePlaylistSection
              key={m.item.id}
              playlist={m.item}
              tracksByPlaylist={tracksByPlaylist}
            />
          ),
        )}
      </ul>
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export function PlaylistDetailView({ id }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportedUrls, setExportedUrls] = useState<
    Record<string, { spotifyPlaylistId: string; url: string }>
  >({});
  const [activeTrack, setActiveTrack] = useState<TrackWithSource | null>(null);

  // インライン名前変更
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { data: playlists } = usePlaylistTree();
  const { data: tracks, isLoading, isError } = usePlaylistTracks(id);
  const { mutate: deletePlaylist, isPending: isDeleting } = useDeletePlaylist();
  const { mutate: updatePlaylist } = useUpdatePlaylist();

  const playlist = playlists ? findPlaylistById(playlists, id) : undefined;

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

  // サーバーデータから containerItems を構築
  const serverContainerItems = useMemo(() => {
    const result: Record<string, MixedItem[]> = {};
    const buildForNode = (pl: Playlist) => {
      const directTracks = tracksByPlaylist.get(pl.id) ?? [];
      const directChildren = pl.children ?? [];
      result[pl.id] = buildMixedList(directTracks, directChildren);
      for (const child of directChildren) {
        buildForNode(child);
      }
    };
    if (playlist) buildForNode(playlist);
    return result;
  }, [tracksByPlaylist, playlist]);

  // 楽観的更新用ローカル状態
  const [localContainerItems, setLocalContainerItems] = useState<Record<
    string,
    MixedItem[]
  > | null>(null);

  // サーバーデータが変わったらローカル状態をリセット
  useEffect(() => {
    setLocalContainerItems(null);
  }, [serverContainerItems]);

  const displayContainerItems = localContainerItems ?? serverContainerItems;

  // trackId → playlistId のマップを構築
  const trackToContainer = useMemo(() => {
    const map = new Map<string, string>();
    for (const [playlistId, items] of Object.entries(displayContainerItems)) {
      for (const m of items) {
        if (m.kind === "track") {
          map.set(m.item.id, playlistId);
        }
      }
    }
    return map;
  }, [displayContainerItems]);

  const dndCtxValue = useMemo(
    () => ({ trackToContainer, containerItems: displayContainerItems }),
    [trackToContainer, displayContainerItems],
  );

  // reorderItems mutation（playlistId を動的に指定）
  const { mutate: reorderItemsMutate } = useMutation({
    mutationFn: ({
      playlistId,
      items,
    }: {
      playlistId: string;
      items: Array<{ type: "track" | "playlist"; id: string }>;
    }) => api.playlists.reorderItems(playlistId, items),
    onError: () => {
      setLocalContainerItems(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    },
  });

  // moveTrack mutation
  const { mutate: moveTrackMutate } = useMutation({
    mutationFn: ({
      trackId,
      targetPlaylistId,
      order,
    }: {
      trackId: string;
      targetPlaylistId: string;
      order: number;
    }) => api.playlists.moveTrack(id, trackId, targetPlaylistId, order),
    onError: () => {
      setLocalContainerItems(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const containerId = trackToContainer.get(activeId);
    if (!containerId) return;
    const items = displayContainerItems[containerId] ?? [];
    const found = items.find((m) => m.kind === "track" && m.item.id === activeId);
    if (found?.kind === "track") {
      setActiveTrack(found.item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTrack(null);

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceContainerId = trackToContainer.get(activeId);
    const targetContainerId = trackToContainer.get(overId) ?? overId;

    if (!sourceContainerId || !targetContainerId) return;

    if (sourceContainerId === targetContainerId) {
      // 同一コンテナ: 並び替え
      const items = displayContainerItems[sourceContainerId] ?? [];
      const oldIndex = items.findIndex((m) => m.item.id === activeId);
      const newIndex = items.findIndex((m) => m.item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newItems = arrayMove(items, oldIndex, newIndex);
      setLocalContainerItems((prev) => ({
        ...(prev ?? displayContainerItems),
        [sourceContainerId]: newItems,
      }));

      reorderItemsMutate({
        playlistId: sourceContainerId,
        items: newItems.map((m) => ({
          type: m.kind === "track" ? ("track" as const) : ("playlist" as const),
          id: m.item.id,
        })),
      });
    } else {
      // クロスコンテナ: トラック移動
      const activeItemInSource = displayContainerItems[sourceContainerId]?.find(
        (m) => m.item.id === activeId,
      );
      if (!activeItemInSource || activeItemInSource.kind !== "track") return;

      const targetItems = displayContainerItems[targetContainerId] ?? [];
      const order = targetItems.filter((m) => m.kind === "track").length;

      // 楽観的更新
      setLocalContainerItems((prev) => {
        const current = prev ?? displayContainerItems;
        return {
          ...current,
          [sourceContainerId]: (current[sourceContainerId] ?? []).filter(
            (m) => m.item.id !== activeId,
          ),
          [targetContainerId]: [...(current[targetContainerId] ?? []), activeItemInSource],
        };
      });

      moveTrackMutate({ trackId: activeId, targetPlaylistId: targetContainerId, order });
    }
  };

  const { mutate: exportPlaylist, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const res = await api.spotify.exportTree(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      setExportedUrls(data);
    },
  });

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

  const directChildren = playlist?.children ?? [];
  const hasContent =
    Object.values(displayContainerItems).some((items) => items.length > 0);

  return (
    <DetailDndCtx.Provider value={dndCtxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTrack(null)}
      >
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
                {tracks?.length ?? 0} 曲
              </p>

              {/* アクションボタン */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
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
                {/* 書き出しボタン */}
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
                {/* Spotify で開くボタン（書き出し完了後に活性化） */}
                {exportedUrls[id] ? (
                  <a
                    href={exportedUrls[id].url}
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
                    disabled
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-foreground/20 text-sm cursor-not-allowed"
                  >
                    <ExternalLink size={14} />
                    Spotify で開く
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

          {/* ─── コンテンツリスト ─── */}
          {hasContent ? (
            <div>
              {/* カラムヘッダー（直接トラックがある場合のみ表示） */}
              {(displayContainerItems[id] ?? []).some((m) => m.kind === "track") && (
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
              )}
              <PlaylistLevelContent
                playlistId={id}
                directChildren={directChildren}
                tracksByPlaylist={tracksByPlaylist}
              />
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
              playlist={playlist}
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

        {/* DragOverlay */}
        <DragOverlay>
          {activeTrack ? <DragOverlayTrackItem track={activeTrack} /> : null}
        </DragOverlay>
      </DndContext>
    </DetailDndCtx.Provider>
  );
}
