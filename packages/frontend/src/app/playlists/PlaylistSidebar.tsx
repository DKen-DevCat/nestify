"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { PlaylistTree } from "@/components/tree/PlaylistTree";
import { usePlaylistStore } from "@/stores/playlistStore";
import { usePlaylistTree } from "@/hooks/usePlaylistTree";
import { useUpdatePlaylist } from "@/hooks/usePlaylistMutations";
import { useSidebar } from "@/hooks/useSidebar";
import type { Playlist } from "@nestify/shared";

const CreatePlaylistModal = dynamic(() =>
  import("@/components/playlist/CreatePlaylistModal").then((m) => ({ default: m.CreatePlaylistModal }))
);
const ImportPlaylistModal = dynamic(() =>
  import("@/components/spotify/ImportPlaylistModal").then((m) => ({ default: m.ImportPlaylistModal }))
);

function findPlaylistById(pls: Playlist[], id: string): Playlist | undefined {
  for (const p of pls) {
    if (p.id === id) return p;
    const found = findPlaylistById(p.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

interface PlaylistSidebarProps {
  /** モバイル drawer 利用時: プレイリスト選択後に呼ばれるコールバック */
  onNavigate?: () => void;
}

export function PlaylistSidebar({ onNavigate }: PlaylistSidebarProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { isOpen, width, toggle, startResize } = useSidebar();

  // 未認証の場合はログインページへリダイレクト（クッキーもクリア）
  useEffect(() => {
    const token = localStorage.getItem("nestify_token");
    if (!token) {
      document.cookie = "nestify_token=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [router]);

  const { selectedId, expandedIds, select, toggleExpand } = usePlaylistStore();
  const { data: playlists, isLoading, isError } = usePlaylistTree();
  const { mutate: updatePlaylist } = useUpdatePlaylist();

  const handleSelect = (id: string) => {
    select(id);
    router.push(`/playlists/${id}`);
    onNavigate?.();
  };

  const handleReorder = (activeId: string, overId: string) => {
    if (!playlists) return;

    const rootPlaylists = playlists.filter((p) => p.parentId === null);
    const activeIndex = rootPlaylists.findIndex((p) => p.id === activeId);
    const overIndex = rootPlaylists.findIndex((p) => p.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    updatePlaylist({ id: activeId, dto: { order: overIndex } });
    updatePlaylist({ id: overId, dto: { order: activeIndex } });
  };

  const handleNest = (activeId: string, newParentId: string) => {
    if (!playlists) return;

    // 循環参照チェック: newParentId が activeId の子孫でないことを確認
    const isDescendantOf = (targetId: string, ancestorId: string): boolean => {
      const ancestor = findPlaylistById(playlists, ancestorId);
      if (!ancestor) return false;
      const check = (pl: Playlist): boolean =>
        pl.id === targetId || (pl.children ?? []).some(check);
      return check(ancestor);
    };

    if (isDescendantOf(newParentId, activeId)) return;

    const newParent = findPlaylistById(playlists, newParentId);
    const order = newParent?.children?.length ?? 0;
    updatePlaylist({ id: activeId, dto: { parentId: newParentId, order } });
  };

  return (
    <>
      {/* 閉じているとき: スリムな展開ボタン（デスクトップのみ） */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          title="サイドバーを展開"
          className="hidden md:flex items-center justify-center w-6 shrink-0 border-r border-white/8 hover:bg-white/[0.03] text-foreground/30 hover:text-accent-purple transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      )}

      <aside
        style={{ width: isOpen ? width : 0 }}
        className="shrink-0 border-r border-white/8 flex flex-col relative overflow-hidden transition-[width] duration-200"
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-4 py-3.5 min-w-0"
          style={{
            borderBottom: "1px solid rgba(124,106,247,0.12)",
            background: "linear-gradient(180deg, rgba(124,106,247,0.06) 0%, transparent 100%)",
          }}
        >
          <h1 className="font-[family-name:var(--font-syne)] font-bold text-base truncate text-gradient">
            Nestify
          </h1>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              title="Spotify からインポート"
              onClick={() => setIsImporting(true)}
              className="p-1.5 rounded-md hover:bg-white/8 text-foreground/35 hover:text-foreground/70 transition-colors"
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              title="新しいプレイリストを作成"
              onClick={() => setIsCreating(true)}
              className="p-1.5 rounded-md hover:bg-white/8 text-foreground/35 hover:text-foreground/70 transition-colors"
            >
              <Plus size={15} />
            </button>
            {/* 折りたたみボタン（デスクトップのみ） */}
            <button
              type="button"
              title="サイドバーを折りたたむ"
              onClick={toggle}
              className="hidden md:flex p-1.5 rounded-md hover:bg-white/8 text-foreground/35 hover:text-foreground/70 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>

        {/* ツリー */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-accent-purple/60 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <p className="text-accent-pink/70 text-xs px-3 py-4 text-center">
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
              onNest={handleNest}
            />
          )}

          {playlists && playlists.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-foreground/25 text-xs leading-relaxed">
                プレイリストがありません<br />
                <span className="text-accent-purple/50">＋</span> で作成できます
              </p>
            </div>
          )}
        </div>

        {/* ドラッグリサイズハンドル（デスクトップのみ） */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hidden md:block transition-colors"
          style={{}}
          onMouseDown={startResize}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(124,106,247,0.3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        />
      </aside>

      {/* モーダルは aside 外に配置（width:0 で消えるのを防ぐ） */}
      {isCreating && (
        <CreatePlaylistModal
          parentId={null}
          onClose={() => setIsCreating(false)}
        />
      )}

      {isImporting && (
        <ImportPlaylistModal
          parentId={null}
          onClose={() => setIsImporting(false)}
        />
      )}
    </>
  );
}
