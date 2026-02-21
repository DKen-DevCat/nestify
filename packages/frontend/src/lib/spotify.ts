// Spotify Web Playback SDK の型定義
declare global {
  interface Window {
    Spotify: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayerOptions {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string) => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
}

interface SpotifyPlaybackState {
  track_window: {
    current_track: SpotifyWebTrack;
  };
  paused: boolean;
  position: number;
  duration: number;
}

interface SpotifyWebTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

let player: SpotifyPlayer | null = null;
let deviceId: string | null = null;

function loadSdkScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("spotify-sdk")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => resolve();
  });
}

export async function initSpotifyPlayer(
  onReady: (id: string) => void,
  onStateChange: (state: SpotifyPlaybackState | null) => void,
): Promise<SpotifyPlayer | null> {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    console.warn("NEXT_PUBLIC_SPOTIFY_CLIENT_ID is not set — player is stubbed");
    return null;
  }

  await loadSdkScript();

  player = new window.Spotify.Player({
    name: "Nestify Player",
    getOAuthToken: (cb) => {
      const token = localStorage.getItem("nestify_token");
      if (token) cb(token);
    },
    volume: 0.5,
  });

  player.addListener("ready", (data) => {
    deviceId = (data as { device_id: string }).device_id;
    onReady(deviceId);
  });

  player.addListener("player_state_changed", (state) => {
    onStateChange(state as SpotifyPlaybackState | null);
  });

  await player.connect();
  return player;
}

export function getDeviceId(): string | null {
  return deviceId;
}

export function getPlayer(): SpotifyPlayer | null {
  return player;
}

/** Spotify Connect API でプレイリストのトラック URI を再生開始 */
export async function startPlayback(
  trackUris: string[],
  accessToken: string,
): Promise<void> {
  if (!deviceId) {
    console.warn("No Spotify device connected");
    return;
  }

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: trackUris }),
  });
}
