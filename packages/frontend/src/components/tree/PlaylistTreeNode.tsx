"use client";

import { ChevronRight, ChevronDown, Music2 } from "lucide-react";
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
    <li>
      <button
        type="button"
        onClick={handleSelect}
        className={[
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors",
          "hover:bg-white/5",
          isSelected
            ? "bg-accent-purple/20 text-accent-purple"
            : "text-foreground/80",
        ].join(" ")}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* 展開アイコン（子がある場合のみ表示） */}
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

        {/* アイコン（絵文字） */}
        <span className="shrink-0 text-base leading-none">{playlist.icon}</span>

        {/* 名前 */}
        <span className="truncate font-medium">{playlist.name}</span>

        {/* トラック数バッジ */}
        {playlist.trackCount !== undefined && playlist.trackCount > 0 && (
          <span className="ml-auto shrink-0 flex items-center gap-0.5 text-foreground/30 text-xs font-[family-name:var(--font-space-mono)]">
            <Music2 size={10} />
            {playlist.trackCount}
          </span>
        )}
      </button>

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
