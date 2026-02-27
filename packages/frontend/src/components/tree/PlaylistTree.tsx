"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
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
  onNest?: (activeId: string, parentId: string) => void;
}

type DragOverInfo = {
  id: string;
  zone: "before" | "inside" | "after";
};

export function PlaylistTree({
  playlists,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onReorder,
  onNest,
}: Props) {
  const [dragOverInfo, setDragOverInfo] = useState<DragOverInfo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || String(over.id) === String(active.id)) {
      setDragOverInfo(null);
      return;
    }

    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    if (!activeRect) return;

    const activeCenterY = activeRect.top + activeRect.height / 2;
    const relY = (activeCenterY - overRect.top) / overRect.height;
    const zone: "before" | "inside" | "after" =
      relY < 0.33 ? "before" : relY > 0.67 ? "after" : "inside";

    setDragOverInfo({ id: String(over.id), zone });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;

    if (!dragOverInfo) {
      setDragOverInfo(null);
      return;
    }

    const { id: overId, zone } = dragOverInfo;
    if (String(active.id) === overId) {
      setDragOverInfo(null);
      return;
    }

    if (zone === "inside") {
      onNest?.(String(active.id), overId);
    } else {
      onReorder?.(String(active.id), overId);
    }

    setDragOverInfo(null);
  };

  const handleDragCancel = () => {
    setDragOverInfo(null);
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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
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
              dragOverZone={
                dragOverInfo?.id === playlist.id ? dragOverInfo.zone : undefined
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
