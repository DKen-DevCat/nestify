"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PlaylistTree } from "@/components/tree/PlaylistTree";
import { usePlaylistStore } from "@/stores/playlistStore";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";

export function PlaylistSidebar() {
  const router = useRouter();
  const { selectedId, expandedIds, select, toggleExpand } = usePlaylistStore();
  const { data: playlists, isLoading, isError } = usePlaylistTree();

  const handleSelect = (id: string) => {
    select(id);
    router.push(`/playlists/${id}`);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-white/10 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h1 className="font-[family-name:var(--font-syne)] text-accent-purple font-bold text-lg">
          Nestify
        </h1>
        <button
          type="button"
          title="新しいプレイリストを作成"
          className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* ツリー */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-accent-pink text-xs px-2 py-4 text-center">
            プレイリストの読み込みに失敗しました
          </p>
        )}

        {playlists && (
          <PlaylistTree
            playlists={playlists}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={handleSelect}
            onToggleExpand={toggleExpand}
          />
        )}
      </div>
    </aside>
  );
}
