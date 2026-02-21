"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Playlist } from "@nestify/shared";
import { PlaylistTreeNode } from "./PlaylistTreeNode";

interface Props {
  playlists: Playlist[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onReorder?: (activeId: string, overId: string) => void;
}

export function PlaylistTree({
  playlists,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorder) {
      onReorder(String(active.id), String(over.id));
    }
  };

  if (playlists.length === 0) {
    return (
      <p className="text-foreground/30 text-xs px-2 py-4 text-center">
        プレイリストがありません
      </p>
    );
  }

  const rootIds = playlists.map((p) => p.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
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
      </SortableContext>
    </DndContext>
  );
}
