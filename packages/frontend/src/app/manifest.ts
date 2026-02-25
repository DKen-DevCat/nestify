import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nestify",
    short_name: "Nestify",
    description: "Spotify のプレイリストをフォルダのように無限にネストして管理",
    start_url: "/",
    display: "standalone",
    background_color: "#07070f",
    theme_color: "#7c6af7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
