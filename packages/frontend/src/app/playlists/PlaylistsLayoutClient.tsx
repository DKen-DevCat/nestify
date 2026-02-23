"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
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
      <div
        className="flex items-center px-4 py-3 md:hidden"
        style={{
          borderBottom: "1px solid rgba(124,106,247,0.12)",
          background: "linear-gradient(180deg, rgba(124,106,247,0.06) 0%, transparent 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-white/8 text-foreground/40 hover:text-foreground/70 transition-colors"
          aria-label="メニューを開く"
        >
          <Menu size={18} />
        </button>
        <span className="ml-3 font-[family-name:var(--font-syne)] font-bold text-base text-gradient">
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
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            {/* drawer 本体 */}
            <div className="fixed inset-y-0 left-0 z-50 flex md:hidden animate-slide-in-left">
              <PlaylistSidebar onNavigate={() => setIsMobileOpen(false)} />
            </div>
          </>
        )}

        <main className="relative z-[1] flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
