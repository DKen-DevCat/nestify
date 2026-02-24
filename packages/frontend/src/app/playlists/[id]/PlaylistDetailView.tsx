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
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { usePlaylistTracks } from "@/hooks/usePlaylistTracks";
import {
  useDeletePlaylist,
  useUpdatePlaylist,
} from "@/hooks/usePlaylistMutations";
import { api } from "@/lib/api";

const CreatePlaylistModal = dynamic(() =>
  import("@/components/playlist/CreatePlaylistModal").then((m) => ({ default: m.CreatePlaylistModal }))
);
const AddTrackModal = dynamic(() =>
  import("@/components/spotify/AddTrackModal").then((m) => ({ default: m.AddTrackModal }))
);
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
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-lg items-center transition-all duration-150 cursor-pointer hover:bg-white/[0.04]"
    >
      <span
        className="flex items-center justify-center text-foreground/20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </span>

      <span className="w-6 text-center text-foreground/25 text-xs font-[family-name:var(--font-space-mono)] group-hover:text-foreground/40 transition-colors">
        {index + 1}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <div
          className="relative w-9 h-9 rounded-md shrink-0 overflow-hidden bg-white/5 transition-transform duration-150 group-hover:scale-[1.05]"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
        >
          {track.track?.imageUrl ? (
            <Image
              src={track.track.imageUrl}
              alt={track.track.album}
              fill
              className="object-cover"
              sizes="36px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={12} className="text-foreground/20" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-foreground/90 group-hover:text-foreground transition-colors">
            {track.track?.name ?? track.spotifyTrackId}
          </p>
          <p className="text-xs text-foreground/40 truncate">
            {track.track?.artists.join(", ")}
          </p>
        </div>
      </div>

      <span className="text-foreground/35 text-xs truncate">
        {track.track?.album ?? "--"}
      </span>

      <span className="text-foreground/25 text-xs font-[family-name:var(--font-space-mono)]">
        {formatDate(track.addedAt)}
      </span>

      <span className="text-foreground/25 text-xs font-[family-name:var(--font-space-mono)]">
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
    <div
      className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-lg items-center opacity-90"
      style={{
        background: "rgba(20, 18, 40, 0.95)",
        border: "1px solid rgba(124,106,247,0.35)",
        boxShadow: "0 8px 30px rgba(124,106,247,0.2), 0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <span className="flex items-center justify-center text-accent-purple/50">
        <GripVertical size={12} />
      </span>
      <span className="w-6" />
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-9 h-9 rounded-md shrink-0 overflow-hidden bg-white/5">
          {track.track?.imageUrl ? (
            <Image
              src={track.track.imageUrl}
              alt={track.track.album}
              fill
              className="object-cover"
              sizes="36px"
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
    <li className="group grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-1.5 rounded-lg items-center hover:bg-white/[0.04] transition-all duration-150">
      <span className="w-6 text-center text-foreground/25 text-xs font-[family-name:var(--font-space-mono)] group-hover:text-foreground/40 transition-colors">
        {index + 1}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-8 h-8 rounded-md shrink-0 overflow-hidden bg-white/5">
          {track.track?.imageUrl ? (
            <Image
              src={track.track.imageUrl}
              alt={track.track.album}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={10} className="text-foreground/20" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-foreground/85 group-hover:text-foreground transition-colors">
            {track.track?.name ?? track.spotifyTrackId}
          </p>
          <p className="text-xs text-foreground/40 truncate">
            {track.track?.artists.join(", ")}
          </p>
        </div>
      </div>

      <span className="text-foreground/35 text-xs truncate">
        {track.track?.album ?? "--"}
      </span>

      <span className="text-foreground/25 text-xs font-[family-name:var(--font-space-mono)]">
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
    opacity: isDragging ? 0.35 : 1,
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
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  };

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all duration-150 mt-1">
        <span
          className="text-foreground/15 hover:text-foreground/35 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-foreground/35 hover:text-foreground/60 shrink-0 transition-colors"
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {playlist.imageUrl ? (
          <div className="relative w-5 h-5 rounded shrink-0 overflow-hidden">
            <Image
              src={playlist.imageUrl}
              alt={playlist.name}
              fill
              className="object-cover"
              sizes="20px"
            />
          </div>
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
          <span className="text-sm font-medium truncate flex-1 text-foreground/80">{playlist.name}</span>
        )}
        {!isRenaming && (
          <button
            type="button"
            onClick={startRenaming}
            className="text-foreground/15 hover:text-foreground/40 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
        )}
        {totalTracks > 0 && (
          <span className="text-xs text-foreground/25 font-[family-name:var(--font-space-mono)] shrink-0">
            {totalTracks}
          </span>
        )}
      </div>

      {expanded && (
        <div
          className="ml-4 pl-3 mt-0.5"
          style={{ borderLeft: "1px solid rgba(124,106,247,0.1)" }}
        >
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
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-purple/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16">
        <p className="text-accent-pink/70 text-sm">トラックの読み込みに失敗しました</p>
      </div>
    );
  }

  const directChildren = playlist?.children ?? [];
  const hasContent =
    Object.values(displayContainerItems).some((items) => items.length > 0);

  // カバーカラーからグロー色を抽出（グラデーションはそのまま使う）
  const coverColor = playlist?.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)";

  return (
    <DetailDndCtx.Provider value={dndCtxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTrack(null)}
      >
        <div className="space-y-6 animate-fade-in">
          {/* ヘッダー */}
          <div className="flex items-start gap-5">
            {/* カバーアート */}
            <div
              className="relative w-24 h-24 rounded-2xl shrink-0 overflow-hidden"
              style={{
                background: playlist?.imageUrl ? undefined : coverColor,
                boxShadow: playlist?.imageUrl
                  ? "0 8px 30px rgba(0,0,0,0.5)"
                  : "0 8px 30px rgba(124,106,247,0.3), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              {playlist?.imageUrl ? (
                <Image
                  src={playlist.imageUrl}
                  alt={playlist.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
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
                  <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold truncate text-foreground/95">
                    {playlist?.name ?? "プレイリスト"}
                  </h1>
                  <Pencil
                    size={13}
                    className="text-foreground/15 group-hover:text-foreground/40 transition-colors shrink-0"
                  />
                </button>
              )}

              <p className="text-foreground/35 text-xs mt-1 font-[family-name:var(--font-space-mono)] tracking-wide">
                {tracks?.length ?? 0} 曲
              </p>

              {/* アクションボタン */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <ActionButton
                  icon={<Plus size={14} />}
                  label="サブPL"
                  onClick={() => setIsAddingChild(true)}
                />
                <ActionButton
                  icon={<ListPlus size={14} />}
                  label="曲を追加"
                  onClick={() => setIsAddingTrack(true)}
                />
                <ActionButton
                  icon={
                    isExporting ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )
                  }
                  label="Spotify へ書き出し"
                  onClick={() => exportPlaylist()}
                  disabled={isExporting}
                />
                {/* Spotify で開くボタン */}
                {exportedUrls[id] ? (
                  <a
                    href={exportedUrls[id].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 hover:scale-[1.02]"
                    style={{
                      border: "1px solid rgba(106,247,200,0.3)",
                      color: "#6af7c8",
                      background: "rgba(106,247,200,0.06)",
                    }}
                  >
                    <ExternalLink size={13} />
                    Spotify で開く
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-white/8 text-foreground/20 cursor-not-allowed"
                  >
                    <ExternalLink size={13} />
                    Spotify で開く
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-foreground/25 hover:text-accent-pink hover:bg-accent-pink/8 transition-all ml-auto"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ─── コンテンツリスト ─── */}
          {hasContent ? (
            <div>
              {/* カラムヘッダー（直接トラックがある場合のみ表示） */}
              {(displayContainerItems[id] ?? []).some((m) => m.kind === "track") && (
                <div
                  className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 text-xs mb-1"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    color: "rgba(232,230,240,0.25)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "10px",
                  }}
                >
                  <span />
                  <span className="w-6 text-center">#</span>
                  <span>タイトル</span>
                  <span>アルバム</span>
                  <span>追加日</span>
                  <span className="flex items-center justify-end">
                    <Clock size={11} />
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
            <div className="text-center py-16">
              <div className="inline-flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(124,106,247,0.08)",
                    border: "1px solid rgba(124,106,247,0.15)",
                  }}
                >
                  <Music2 size={20} className="text-accent-purple/40" />
                </div>
                <div>
                  <p className="text-foreground/30 text-sm">曲がありません</p>
                  <p className="text-foreground/18 text-xs mt-1">
                    「曲を追加」から Spotify の楽曲を追加できます
                  </p>
                </div>
              </div>
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setConfirmDelete(false)}
            >
              <div
                className="w-full max-w-xs mx-4 rounded-2xl p-6 shadow-2xl animate-fade-in-up"
                style={{
                  background: "rgba(12, 11, 22, 0.98)",
                  border: "1px solid rgba(247,106,138,0.2)",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="font-[family-name:var(--font-syne)] text-base font-bold mb-2 text-foreground">
                  プレイリストを削除
                </h2>
                <p className="text-foreground/45 text-sm mb-5 leading-relaxed">
                  「{playlist?.name}」を削除します。<br />
                  子プレイリストも含めて削除されます。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-foreground/50 hover:bg-white/5 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                    style={{
                      background: "rgba(247,106,138,0.15)",
                      color: "#f76a8a",
                      border: "1px solid rgba(247,106,138,0.25)",
                    }}
                  >
                    {isDeleting ? "削除中..." : "削除"}
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

// ---------------------------------------------------------------------------
// ActionButton コンポーネント
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, onClick, disabled }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(232,230,240,0.7)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
