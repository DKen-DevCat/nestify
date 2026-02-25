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
import { Skeleton } from "@/components/ui/Skeleton";
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
          title="ライブラリを展開"
          className="hidden md:flex flex-col items-center justify-start gap-1 w-10 pt-4 shrink-0 border-r border-white/6 hover:bg-white/[0.04] text-white/30 hover:text-white/60 transition-colors duration-150"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <aside
        style={{ width: isOpen ? width : 0 }}
        className="shrink-0 border-r border-white/8 flex flex-col relative overflow-hidden transition-[width] duration-200"
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-3 py-3 min-w-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-syne)] font-bold text-sm text-white/80">
              マイライブラリ
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              title="Spotify からインポート"
              onClick={() => setIsImporting(true)}
              className="p-1.5 rounded-md hover:bg-white/8 text-white/35 hover:text-white/70 transition-colors duration-150"
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              title="新しいプレイリストを作成"
              onClick={() => setIsCreating(true)}
              className="p-1.5 rounded-md hover:bg-white/8 text-white/35 hover:text-white/70 transition-colors duration-150"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              title="サイドバーを折りたたむ"
              onClick={toggle}
              className="hidden md:flex p-1.5 rounded-md hover:bg-white/8 text-white/35 hover:text-white/70 transition-colors duration-150"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>

        {/* ツリー */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* セクションラベル */}
          <div className="px-2 pt-2 pb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
              プレイリスト
            </span>
          </div>
          {isLoading && (
            // 実ノードと同一の構造・寸法でスケルトンを描画しレイアウトシフトを防ぐ
            <div>
              {(
                [
                  { w: "w-28", count: true },
                  { w: "w-36", count: false },
                  { w: "w-20", count: true },
                  { w: "w-32", count: false },
                  { w: "w-24", count: true },
                  { w: "w-28", count: false },
                ] as const
              ).map(({ w, count }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 py-2 rounded-lg"
                  style={{ paddingLeft: "8px", paddingRight: "8px" }}
                >
                  {/* ドラッグハンドルのスペーサー（w-4） */}
                  <span className="shrink-0 w-4" />
                  {/* シェブロンのスペーサー（w-4） */}
                  <span className="shrink-0 w-4" />
                  {/* アイコン：実コンテンツと同サイズ w-8 h-8 */}
                  <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                  {/* プレイリスト名 */}
                  <Skeleton className={`h-3.5 ${w} flex-1 ml-1`} />
                  {/* トラック数バッジ（任意） */}
                  {count && <Skeleton className="h-3 w-5 shrink-0" />}
                </div>
              ))}
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
