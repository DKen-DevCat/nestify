"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";
import { PlaylistTree } from "@/components/tree/PlaylistTree";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { ImportPlaylistModal } from "@/components/spotify/ImportPlaylistModal";
import { usePlaylistStore } from "@/stores/playlistStore";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { useUpdatePlaylist } from "@/hooks/usePlaylistMutations";

export function PlaylistSidebar() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // 未認証の場合はログインページへリダイレクト
  useEffect(() => {
    const token = localStorage.getItem("nestify_token");
    if (!token) {
      router.replace("/login");
    }
  }, [router]);
  const { selectedId, expandedIds, select, toggleExpand } = usePlaylistStore();
  const { data: playlists, isLoading, isError } = usePlaylistTree();
  const { mutate: updatePlaylist } = useUpdatePlaylist();

  const handleSelect = (id: string) => {
    select(id);
    router.push(`/playlists/${id}`);
  };

  const handleReorder = (activeId: string, overId: string) => {
    if (!playlists) return;

    // ルートレベルで並び替え: activeId の order を overId の order に
    const rootPlaylists = playlists.filter((p) => p.parentId === null);
    const activeIndex = rootPlaylists.findIndex((p) => p.id === activeId);
    const overIndex = rootPlaylists.findIndex((p) => p.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    updatePlaylist({ id: activeId, dto: { order: overIndex } });
    // 移動先の order に挿入後、残りを再番号付け
    updatePlaylist({ id: overId, dto: { order: activeIndex } });
  };

  return (
    <aside className="w-64 shrink-0 border-r border-white/10 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h1 className="font-[family-name:var(--font-syne)] text-accent-purple font-bold text-lg">
          Nestify
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Spotify からインポート"
            onClick={() => setIsImporting(true)}
            className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            title="新しいプレイリストを作成"
            onClick={() => setIsCreating(true)}
            className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
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
            onReorder={handleReorder}
          />
        )}
      </div>

      {/* プレイリスト作成モーダル */}
      {isCreating && (
        <CreatePlaylistModal
          parentId={null}
          onClose={() => setIsCreating(false)}
        />
      )}

      {/* Spotify インポートモーダル */}
      {isImporting && (
        <ImportPlaylistModal
          parentId={null}
          onClose={() => setIsImporting(false)}
        />
      )}
    </aside>
  );
}
