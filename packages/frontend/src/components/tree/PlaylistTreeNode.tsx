"use client";

import { ChevronRight, ChevronDown, Music2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import type { Playlist } from "@nestify/shared";
import { api } from "@/lib/api";

interface Props {
  playlist: Playlist;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  depth?: number;
  dragOverZone?: "before" | "inside" | "after";
}

export function PlaylistTreeNode({
  playlist,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  depth = 0,
  dragOverZone,
}: Props) {
  const hasChildren = (playlist.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(playlist.id);
  const isSelected = selectedId === playlist.id;
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: ["playlist-tracks", playlist.id],
      queryFn: async () => {
        const result = await api.playlists.tracks(playlist.id);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      },
      staleTime: 5 * 60_000,
    });
  };

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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(playlist.id);
    }
  };

  const handleSelect = () => {
    onSelect(playlist.id);
    if (hasChildren && !isExpanded) {
      onToggleExpand(playlist.id);
    }
  };

  return (
    <li ref={setNodeRef} style={style} className="relative">
      {/* 前インジケーター（上端ドロップ） */}
      {dragOverZone === "before" && (
        <div className="absolute top-0 left-2 right-2 h-[2px] rounded-full z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, #7c6af7, #f76a8a)" }}
        />
      )}

      <div
        className={[
          "group relative flex items-center gap-1 py-2 rounded-lg cursor-pointer",
          "transition-all duration-150",
          isSelected
            ? "text-white"
            : "hover:bg-white/[0.07] text-white/60 hover:text-white/90",
          isDragging ? "ring-1 ring-accent-purple/40" : "",
          dragOverZone === "inside" ? "ring-1 ring-accent-purple/50 bg-accent-purple/8" : "",
        ].join(" ")}
        style={{
          paddingLeft: `${depth * 12 + 8}px`,
          paddingRight: "8px",
          ...(isSelected && {
            background: "linear-gradient(90deg, rgba(124,106,247,0.22) 0%, rgba(124,106,247,0.08) 100%)",
            boxShadow: "inset 2px 0 0 #7c6af7",
          }),
        }}
        onClick={handleSelect}
        onMouseEnter={handleMouseEnter}
      >
        {/* ドラッグハンドル */}
        <span
          className="shrink-0 w-4 h-4 flex items-center justify-center text-foreground/20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>

        {/* 展開アイコン */}
        <span
          className={[
            "shrink-0 w-4 h-4 flex items-center justify-center transition-colors",
            isSelected ? "text-accent-purple/60" : "text-foreground/30",
          ].join(" ")}
          onClick={handleToggle}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* アイコン: Spotify カバー画像があれば表示、なければ絵文字 */}
        <div className="relative shrink-0 w-8 h-8 rounded-md overflow-hidden flex items-center justify-center text-lg leading-none bg-white/5">
          {playlist.imageUrl ? (
            <Image
              src={playlist.imageUrl}
              alt={playlist.name}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            playlist.icon
          )}
        </div>

        {/* 名前 */}
        <span
          className={[
            "truncate text-sm font-medium flex-1 transition-colors duration-150",
            isSelected ? "text-white" : "",
          ].join(" ")}
        >
          {playlist.name}
        </span>

        {/* トラック数 */}
        {playlist.trackCount !== undefined && playlist.trackCount > 0 && (
          <span
            className="ml-auto shrink-0 text-xs font-[family-name:var(--font-space-mono)] transition-colors duration-150"
            style={{ color: isSelected ? "rgba(124,106,247,0.6)" : "rgba(255,255,255,0.25)" }}
          >
            {playlist.trackCount}
          </span>
        )}
      </div>

      {/* 後インジケーター（下端ドロップ） */}
      {dragOverZone === "after" && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, #7c6af7, #f76a8a)" }}
        />
      )}

      {/* 子ノードの再帰レンダリング */}
      {hasChildren && isExpanded && (
        <ul
          className="mt-0.5"
          style={{ borderLeft: `1px solid rgba(124,106,247,0.12)`, marginLeft: `${depth * 12 + 20}px`, paddingLeft: "0" }}
        >
          {playlist.children!.map((child) => (
            <PlaylistTreeNode
              key={child.id}
              playlist={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
