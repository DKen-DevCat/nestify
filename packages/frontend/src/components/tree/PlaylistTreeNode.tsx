"use client";

import { ChevronRight, ChevronDown, Music2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Playlist } from "@nestify/shared";

interface Props {
  playlist: Playlist;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  depth?: number;
}

export function PlaylistTreeNode({
  playlist,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  depth = 0,
}: Props) {
  const hasChildren = (playlist.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(playlist.id);
  const isSelected = selectedId === playlist.id;

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
    <li ref={setNodeRef} style={style}>
      <div
        className={[
          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          "hover:bg-white/5",
          isSelected ? "bg-accent-purple/20" : "",
          isDragging ? "ring-1 ring-accent-purple/40" : "",
        ].join(" ")}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleSelect}
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
          className="shrink-0 w-4 h-4 flex items-center justify-center text-foreground/40"
          onClick={handleToggle}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* アイコン: Spotify カバー画像があれば表示、なければ絵文字 */}
        <span className="shrink-0 w-5 h-5 rounded overflow-hidden flex items-center justify-center text-sm leading-none">
          {playlist.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={playlist.imageUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            playlist.icon
          )}
        </span>

        {/* 名前 */}
        <span
          className={[
            "truncate text-sm font-medium flex-1",
            isSelected ? "text-accent-purple" : "text-foreground/80",
          ].join(" ")}
        >
          {playlist.name}
        </span>

        {/* トラック数 */}
        {playlist.trackCount !== undefined && playlist.trackCount > 0 && (
          <span className="ml-auto shrink-0 flex items-center gap-0.5 text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
            <Music2 size={10} />
            {playlist.trackCount}
          </span>
        )}
      </div>

      {/* 子ノードの再帰レンダリング */}
      {hasChildren && isExpanded && (
        <ul className="mt-0.5">
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
