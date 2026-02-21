import { NowPlayingBar } from "@/components/player/NowPlayingBar";
import { PlaylistSidebar } from "./PlaylistSidebar";

export default function PlaylistsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* サイドバー + メイン */}
      <div className="flex flex-1 overflow-hidden">
        <PlaylistSidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* 再生バー（下部固定） */}
      <NowPlayingBar />
    </div>
  );
}
