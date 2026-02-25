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
  type DragOverEvent,
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

  ChevronDown,
  ChevronRight,
  Pencil,
  RefreshCw,
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
import { InlineTrackSearch } from "@/components/spotify/InlineTrackSearch";
import { Skeleton } from "@/components/ui/Skeleton";

const CreatePlaylistModal = dynamic(() =>
  import("@/components/playlist/CreatePlaylistModal").then((m) => ({ default: m.CreatePlaylistModal }))
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
      className="group grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 rounded-lg items-center transition-all duration-150 hover:bg-white/[0.07] cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span
        className="flex items-center justify-center text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        <GripVertical size={12} />
      </span>

      {/* 番号 */}
      <span className="w-6 h-6 flex items-center justify-center text-xs font-[family-name:var(--font-space-mono)]" style={{ color: "#b3b3b3" }}>
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
          <p className="text-sm font-medium truncate transition-colors duration-150">
            {track.track?.name ?? track.spotifyTrackId}
          </p>
          <p className="text-xs truncate" style={{ color: "#b3b3b3" }}>
            {track.track?.artists.join(", ")}
          </p>
        </div>
      </div>

      <span className="text-xs truncate" style={{ color: "#b3b3b3" }}>
        {track.track?.album ?? "--"}
      </span>

      <span className="text-xs font-[family-name:var(--font-space-mono)]" style={{ color: "#b3b3b3" }}>
        {formatDate(track.addedAt)}
      </span>

      <span className="text-xs font-[family-name:var(--font-space-mono)]" style={{ color: "#b3b3b3" }}>
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
    <li
      className="group grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-1.5 rounded-lg items-center hover:bg-white/[0.04] transition-all duration-150"
    >
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
          <p className="text-sm font-medium truncate">
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
      <div
        className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all duration-150 mt-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span
          className="text-foreground/15 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportedUrls, setExportedUrls] = useState<
    Record<string, { spotifyPlaylistId: string; url: string }>
  >({});
  const [activeTrack, setActiveTrack] = useState<TrackWithSource | null>(null);

  // インライン名前変更
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // スティッキーヘッダー制御
  const heroRef = useRef<HTMLDivElement>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  // DnD: ドラッグ開始時の元コンテナ（DragOver 中も source を正しく参照するため）
  const [dragSourceContainerId, setDragSourceContainerId] = useState<string | null>(null);

  const { data: playlists } = usePlaylistTree();
  const { data: tracks, isLoading, isError, refetch } = usePlaylistTracks(id);
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

  // ヒーローセクションがスクロールアウトしたらスティッキーヘッダーを表示
  // IntersectionObserver は DOM 挿入時のレイアウトシフトでループするため
  // scroll イベント + getBoundingClientRect に切り替え
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const scrollContainer = el.closest("main") as HTMLElement | null;
    if (!scrollContainer) return;

    const check = () => {
      const heroBottom = el.getBoundingClientRect().bottom;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      setShowStickyHeader(heroBottom <= containerTop);
    };

    scrollContainer.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    check(); // 初回チェック
    return () => {
      scrollContainer.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

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
    setDragSourceContainerId(containerId ?? null);
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

    // dragSourceContainerId をローカルに保存してから state をリセットする。
    // handleDragOver が localContainerItems を更新すると trackToContainer も更新され、
    // active アイテムが target コンテナ側にマッピングされてしまう。
    // そのため trackToContainer.get(activeId) では source が誤分類されうる。
    const sourceContainerId = dragSourceContainerId;
    setDragSourceContainerId(null);

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

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
      // handleDragOver が既に localContainerItems を正しい順序に更新済みなので
      // その状態を確定させて API を呼び出す
      const current = localContainerItems ?? displayContainerItems;
      const finalTargetItems = current[targetContainerId] ?? [];

      // moveTrack → reorderItems の順で実行（order の競合を防ぐため）
      (async () => {
        try {
          const moveRes = await api.playlists.moveTrack(id, activeId, targetContainerId, 0);
          if (!moveRes.ok) { setLocalContainerItems(null); return; }

          await api.playlists.reorderItems(
            targetContainerId,
            finalTargetItems.map((m) => ({
              type: m.kind === "track" ? ("track" as const) : ("playlist" as const),
              id: m.item.id,
            })),
          );

          queryClient.invalidateQueries({ queryKey: ["playlist-tracks"] });
          queryClient.invalidateQueries({ queryKey: ["playlists"] });
        } catch {
          setLocalContainerItems(null);
        }
      })();
    }
  };

  // ドラッグ中のクロスコンテナ視覚フィードバック
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // ドラッグ開始時に記録した source を使用（trackToContainer は更新されうるため）
    const sourceId = dragSourceContainerId;
    if (!sourceId) return;

    // over が track の場合 → その track のコンテナ、コンテナ id の場合 → そのまま
    const destId = trackToContainer.get(overId) ?? overId;

    // 同一コンテナは SortableContext に任せる
    if (sourceId === destId) return;

    setLocalContainerItems((prev) => {
      const current = prev ?? displayContainerItems;
      if (!(destId in current)) return current;

      // active item を現在のどこかのコンテナから探す
      let activeItem: MixedItem | undefined;
      for (const items of Object.values(current)) {
        const found = items.find((m) => m.item.id === activeId);
        if (found) { activeItem = found; break; }
      }
      if (!activeItem || activeItem.kind !== "track") return current;

      // dest から active を除いた配列を作り、over の位置に挿入
      const destWithoutActive = (current[destId] ?? []).filter((m) => m.item.id !== activeId);
      const overIdx = destWithoutActive.findIndex((m) => m.item.id === overId);
      const insertAt = overIdx !== -1 ? overIdx : destWithoutActive.length;
      destWithoutActive.splice(insertAt, 0, activeItem);

      // 全コンテナから active を除去し、dest だけ新配列にする
      return Object.fromEntries(
        Object.entries(current).map(([cid, items]) => [
          cid,
          cid === destId ? destWithoutActive : items.filter((m) => m.item.id !== activeId),
        ]),
      );
    });
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
    return <PlaylistDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="text-center py-16 flex flex-col items-center gap-4">
        <p className="text-accent-pink/70 text-sm">トラックの読み込みに失敗しました</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors duration-150 hover:scale-[1.02]"
          style={{
            border: "1px solid rgba(124,106,247,0.3)",
            color: "#7c6af7",
          }}
        >
          <RefreshCw size={14} />
          再試行
        </button>
      </div>
    );
  }

  const directChildren = playlist?.children ?? [];
  const hasContent =
    Object.values(displayContainerItems).some((items) => items.length > 0);

  const coverColor = playlist?.color ?? "linear-gradient(135deg,#7c6af7,#f76a8a)";

  // グラデーション文字列から最初の hex カラーを抽出してヒーロー背景色に使用
  const heroBaseColor = (() => {
    const match = coverColor.match(/#[0-9a-f]{6}/i);
    return match ? match[0] : "#7c6af7";
  })();

  return (
    <DetailDndCtx.Provider value={dndCtxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveTrack(null); setDragSourceContainerId(null); }}
      >
        {/* ─── スティッキーコンパクトヘッダー（ヒーローがスクロールアウト時のみ描画） ─── */}
        {showStickyHeader && (
          <div
            className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 animate-fade-in"
            style={{
              background: "rgba(10,10,20,0.95)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* カバー縮小版 */}
              <div
                className="relative w-8 h-8 rounded shrink-0 overflow-hidden"
                style={{ background: coverColor }}
              >
                {playlist?.imageUrl && (
                  <Image
                    src={playlist.imageUrl}
                    alt={playlist.name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                )}
              </div>
              {/* プレイリスト名 */}
              <span className="font-[family-name:var(--font-syne)] font-bold text-sm text-white truncate flex-1 min-w-0">
                {playlist?.name}
              </span>
              {/* アクションボタン群 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* サブPL */}
                <button
                  type="button"
                  onClick={() => setIsAddingChild(true)}
                  title="サブプレイリストを追加"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(232,230,240,0.7)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Plus size={13} />
                  <span className="hidden sm:inline">サブPL</span>
                </button>
                {/* Spotify へ書き出し */}
                <button
                  type="button"
                  onClick={() => exportPlaylist()}
                  disabled={isExporting}
                  title="Spotify へ書き出し"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(232,230,240,0.7)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {isExporting ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  <span className="hidden sm:inline">書き出し</span>
                </button>
                {/* Spotify で開く（書き出し後のみ） */}
                {exportedUrls[id] && (
                  <a
                    href={exportedUrls[id].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Spotify で開く"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02]"
                    style={{
                      border: "1px solid rgba(106,247,200,0.3)",
                      color: "#6af7c8",
                      background: "rgba(106,247,200,0.06)",
                    }}
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">開く</span>
                  </a>
                )}
              </div>
            </div>
            {/* 検索バー */}
            <div className="mt-1.5">
              <InlineTrackSearch playlistId={id} playlist={playlist} />
            </div>
          </div>
        )}

        <div className="space-y-0 animate-fade-in">
          {/* ─── ヒーローヘッダー ─── */}
          <div
            ref={heroRef}
            className="-mx-4 md:-mx-8 px-4 md:px-8 pt-8 pb-6"
            style={{
              background: `linear-gradient(180deg, ${heroBaseColor}33 0%, ${heroBaseColor}11 50%, transparent 100%)`,
            }}
          >
            <div className="flex items-end gap-6">
              {/* カバーアート（大型化） */}
              <div
                className="relative w-40 h-40 md:w-48 md:h-48 rounded-xl shrink-0 overflow-hidden"
                style={{
                  background: playlist?.imageUrl ? undefined : coverColor,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                {playlist?.imageUrl ? (
                  <Image
                    src={playlist.imageUrl}
                    alt={playlist.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 160px, 192px"
                    priority
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-6xl">
                    {playlist?.icon ?? "🎵"}
                  </span>
                )}
              </div>

              {/* テキスト情報（下揃え） */}
              <div className="min-w-0 flex-1 pb-2">
                <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "#b3b3b3" }}>
                  プレイリスト
                </p>

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
                    className="font-[family-name:var(--font-syne)] text-4xl md:text-5xl font-bold bg-transparent border-b border-accent-purple/50 outline-none w-full text-white"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startRenaming}
                    title="クリックして名前を変更"
                    className="group flex items-center gap-2 text-left w-full"
                  >
                    <h1 className="font-[family-name:var(--font-syne)] text-4xl md:text-5xl font-bold text-white leading-tight">
                      {playlist?.name ?? "プレイリスト"}
                    </h1>
                    <Pencil
                      size={14}
                      className="text-white/15 group-hover:text-white/40 transition-colors shrink-0 mt-1"
                    />
                  </button>
                )}

                <p className="text-sm mt-3 font-[family-name:var(--font-space-mono)]" style={{ color: "#b3b3b3" }}>
                  {tracks?.length ?? 0} 曲
                </p>
              </div>
            </div>
          </div>

          {/* ─── アクションバー ─── */}
          <div className="flex items-center gap-3 pt-6 pb-2 flex-wrap">
            <ActionButton
              icon={<Plus size={14} />}
              label="サブPL"
              onClick={() => setIsAddingChild(true)}
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-white/8 text-white/20 cursor-not-allowed"
              >
                <ExternalLink size={13} />
                Spotify で開く
              </button>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-white/25 hover:text-accent-pink hover:bg-accent-pink/8 transition-all ml-auto"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* ─── インライントラック検索（常時表示） ─── */}
          <InlineTrackSearch
            playlistId={id}
            playlist={playlist}
          />

          {/* ─── コンテンツリスト ─── */}
          {hasContent ? (
            <div>
              {/* カラムヘッダー（直接トラックがある場合のみ表示、sticky） */}
              {(displayContainerItems[id] ?? []).some((m) => m.kind === "track") && (
                <div
                  className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 mb-1 sticky top-0 z-10"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(10,10,20,0.92)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    color: "#b3b3b3",
                    letterSpacing: "0.08em",
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
            <div className="text-center py-24">
              <div className="inline-flex flex-col items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(124,106,247,0.08)",
                    border: "1px solid rgba(124,106,247,0.15)",
                  }}
                >
                  <Music2 size={28} className="text-accent-purple/40" />
                </div>
                <div>
                  <p className="text-white/50 text-base font-medium">このプレイリストは空です</p>
                  <p className="text-white/30 text-sm mt-1">
                    上の検索バーから楽曲を追加するか、サブプレイリストを作成してください
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
// PlaylistDetailSkeleton — ローディング中のスケルトン UI
// 実コンテンツと完全に同一のレイアウト構造を使いレイアウトシフトを防ぐ
// ---------------------------------------------------------------------------

function PlaylistDetailSkeleton() {
  // トラック行ごとのスケルトン幅バリエーション（静的クラス名 = Tailwind に含まれる）
  const rows = [
    { t: "w-36", a: "w-24", al: "w-32" },
    { t: "w-28", a: "w-20", al: "w-40" },
    { t: "w-44", a: "w-28", al: "w-28" },
    { t: "w-32", a: "w-16", al: "w-36" },
    { t: "w-40", a: "w-24", al: "w-24" },
    { t: "w-24", a: "w-20", al: "w-32" },
  ] as const;

  return (
    <div className="space-y-0">
      {/* ─── ヒーローヘッダー（実コンテンツと同一クラス） ─── */}
      <div className="-mx-4 md:-mx-8 px-4 md:px-8 pt-8 pb-6">
        <div className="flex items-end gap-6">
          {/* カバーアート：実コンテンツと同サイズ */}
          <Skeleton className="w-40 h-40 md:w-48 md:h-48 rounded-xl shrink-0" />

          {/* テキストエリア：pb-2 は実コンテンツと同じ下揃え */}
          <div className="min-w-0 flex-1 pb-2">
            {/* "プレイリスト" ラベル（text-xs ≈ h-3, mb-2） */}
            <Skeleton className="h-3 w-16 mb-3" />
            {/* タイトル（text-4xl leading-tight ≈ h-10 / md:text-5xl ≈ md:h-14） */}
            <Skeleton className="h-10 md:h-14 w-3/4" />
            {/* "X 曲" サブタイトル（text-sm mt-3） */}
            <Skeleton className="h-3.5 w-20 mt-3" />
          </div>
        </div>
      </div>

      {/* ─── アクションバー（実コンテンツと同一クラス） ─── */}
      <div className="flex items-center gap-3 pt-6 pb-2 flex-wrap">
        {/* サブPL / Spotify書き出し / Spotifyで開く の pill ボタン */}
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        {/* 削除ボタン（ml-auto） */}
        <Skeleton className="h-7 w-7 rounded-full ml-auto" />
      </div>

      {/* ─── カラムヘッダー（sticky / 実コンテンツと同一グリッド） ─── */}
      <div className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 mb-1">
        <span />
        <Skeleton className="h-2.5 w-4" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-6" />
      </div>

      {/* ─── トラック行（実コンテンツと同一グリッド・パディング） ─── */}
      <ul>
        {rows.map(({ t, a, al }, i) => (
          <li
            key={i}
            className="grid grid-cols-[16px_auto_1fr_1fr_auto_auto] gap-3 px-3 py-2 items-center"
          >
            {/* # 番号（16px 列） */}
            <Skeleton className="h-3 w-3" />
            {/* アルバムアート + 曲名/アーティスト（auto 列）*/}
            <div className="flex items-center gap-3">
              {/* アルバムアート：w-9 h-9 = 実コンテンツと同サイズ */}
              <Skeleton className="w-9 h-9 rounded-md shrink-0" />
              <div className="flex flex-col gap-1.5">
                {/* 曲名（text-sm ≈ h-3.5） */}
                <Skeleton className={`h-3.5 ${t}`} />
                {/* アーティスト（text-xs ≈ h-3） */}
                <Skeleton className={`h-3 ${a}`} />
              </div>
            </div>
            {/* アルバム（1fr 列） */}
            <Skeleton className={`h-3 ${al}`} />
            {/* 追加日（auto 列） */}
            <Skeleton className="h-3 w-16" />
            {/* 再生時間（auto 列） */}
            <Skeleton className="h-3 w-10" />
          </li>
        ))}
      </ul>
    </div>
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
