"use client";

import { useEffect } from "react";
import { initSpotifyPlayer } from "@/lib/spotify";
import { usePlayerStore } from "@/stores/playerStore";

export function useSpotifyPlayer() {
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    if (!clientId) return;

    initSpotifyPlayer(
      (_deviceId) => {
        // デバイス準備完了
      },
      (state) => {
        if (state) {
          setIsPlaying(!state.paused);
        }
      },
    ).catch(console.error);
  }, [setIsPlaying]);
}
