"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { NowPlayingBar } from "@/components/player/NowPlayingBar";
import { PlaylistSidebar } from "./PlaylistSidebar";

export function PlaylistsLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* モバイルヘッダー（md 未満のみ表示） */}
      <div className="flex items-center px-4 py-3 border-b border-white/10 md:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-1 rounded hover:bg-white/10 text-foreground/60 hover:text-foreground transition-colors"
          aria-label="メニューを開く"
        >
          <Menu size={20} />
        </button>
        <span className="ml-3 font-[family-name:var(--font-syne)] text-accent-purple font-bold text-lg">
          Nestify
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* デスクトップ: 通常サイドバー（開閉・リサイズ付き） */}
        <div className="hidden md:flex">
          <PlaylistSidebar />
        </div>

        {/* モバイル: overlay drawer */}
        {isMobileOpen && (
          <>
            {/* backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            {/* drawer 本体 */}
            <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
              <PlaylistSidebar onNavigate={() => setIsMobileOpen(false)} />
            </div>
          </>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      {/* 再生バー（下部固定） */}
      <NowPlayingBar />
    </div>
  );
}
