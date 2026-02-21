"use client";

import { Play, Pause, SkipBack, SkipForward, Shuffle } from "lucide-react";
import { usePlayerStore } from "@/stores/playerStore";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function NowPlayingBar() {
  const { currentTrack, isPlaying, shuffle, next, prev, toggleShuffle } =
    usePlayerStore();

  if (!currentTrack) {
    return (
      <div className="h-16 border-t border-white/10 flex items-center justify-center">
        <p className="text-foreground/30 text-xs">再生中の曲はありません</p>
      </div>
    );
  }

  return (
    <div className="h-16 border-t border-white/10 flex items-center px-4 gap-4">
      {/* トラック情報 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {currentTrack.imageUrl ? (
          <img
            src={currentTrack.imageUrl}
            alt={currentTrack.album}
            className="w-10 h-10 rounded shrink-0 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded shrink-0 bg-white/10 flex items-center justify-center text-foreground/30 text-lg">
            🎵
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-accent-purple">
            {currentTrack.name}
          </p>
          <p className="text-xs text-foreground/50 truncate">
            {currentTrack.artists.join(", ")}
          </p>
        </div>
      </div>

      {/* コントロール */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleShuffle}
          title="シャッフル"
          className={[
            "p-2 rounded-full transition-colors",
            shuffle
              ? "text-accent-purple"
              : "text-foreground/40 hover:text-foreground",
          ].join(" ")}
        >
          <Shuffle size={16} />
        </button>

        <button
          type="button"
          onClick={prev}
          title="前のトラック"
          className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors"
        >
          <SkipBack size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            // Spotify SDK の togglePlay を呼ぶ（今は状態のみ更新）
          }}
          title={isPlaying ? "一時停止" : "再生"}
          className="p-2 rounded-full bg-accent-purple text-white hover:opacity-90 transition-opacity"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          type="button"
          onClick={next}
          title="次のトラック"
          className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* 時間 */}
      <div className="text-foreground/30 text-xs font-[family-name:var(--font-space-mono)] shrink-0">
        {formatDuration(currentTrack.durationMs)}
      </div>
    </div>
  );
}
