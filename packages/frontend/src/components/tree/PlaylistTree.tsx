"use client";

import type { Playlist } from "@nestify/shared";
import { PlaylistTreeNode } from "./PlaylistTreeNode";

interface Props {
  playlists: Playlist[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

export function PlaylistTree({
  playlists,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
}: Props) {
  if (playlists.length === 0) {
    return (
      <p className="text-foreground/30 text-xs px-2 py-4 text-center">
        プレイリストがありません
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {playlists.map((playlist) => (
        <PlaylistTreeNode
          key={playlist.id}
          playlist={playlist}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </ul>
  );
}
