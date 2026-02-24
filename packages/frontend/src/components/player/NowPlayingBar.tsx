"use client";

import Image from "next/image";
import { Music2, Play, Pause, SkipBack, SkipForward, Layers, Disc3 } from "lucide-react";
import { usePlayerStore } from "@/stores/playerStore";

export function NowPlayingBar() {
  const { currentTrack, isPlaying, includeChildren, toggleIncludeChildren, setIsPlaying } =
    usePlayerStore();

  return (
    <div
      className="shrink-0 h-[72px] flex items-center px-4 z-20"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "var(--color-surface)",
      }}
    >
      {/* 左: 曲情報 */}
      <div className="w-1/3 flex items-center gap-3 min-w-0">
        <div
          className="relative w-14 h-14 rounded-md shrink-0 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {currentTrack?.imageUrl ? (
            <Image
              src={currentTrack.imageUrl}
              alt={currentTrack.album}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={20} className="text-foreground/20" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: currentTrack ? "#ffffff" : "rgba(255,255,255,0.25)" }}
          >
            {currentTrack?.name ?? "再生していません"}
          </p>
          {currentTrack && (
            <p className="text-xs truncate" style={{ color: "#b3b3b3" }}>
              {currentTrack.artists.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* 中央: コントロール */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-foreground/40 hover:text-foreground/80 transition-colors"
            disabled={!currentTrack}
          >
            <SkipBack size={18} />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!currentTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: currentTrack ? "#ffffff" : "rgba(255,255,255,0.1)",
              color: "#000000",
            }}
          >
            {isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" className="translate-x-px" />
            )}
          </button>

          <button
            type="button"
            className="text-foreground/40 hover:text-foreground/80 transition-colors"
            disabled={!currentTrack}
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* 右: モードトグル */}
      <div className="w-1/3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={toggleIncludeChildren}
          title={includeChildren ? "子孫プレイリストを含めて再生中" : "直接追加の曲のみ再生中"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all"
          style={{
            border: includeChildren
              ? "1px solid rgba(124,106,247,0.5)"
              : "1px solid rgba(255,255,255,0.12)",
            color: includeChildren ? "#7c6af7" : "rgba(255,255,255,0.35)",
            background: includeChildren ? "rgba(124,106,247,0.1)" : "transparent",
          }}
        >
          {includeChildren ? <Layers size={12} /> : <Disc3 size={12} />}
          <span className="hidden sm:inline">
            {includeChildren ? "子孫含む" : "直接のみ"}
          </span>
        </button>
      </div>
    </div>
  );
}
