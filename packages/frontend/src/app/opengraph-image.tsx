import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Nestify — ネスト型プレイリスト管理";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #07070f 0%, #0f0d1f 60%, #150d2a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* 背景グロー */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,106,247,0.25) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(247,106,138,0.2) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* ロゴアイコン */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            background: "linear-gradient(135deg, rgba(124,106,247,0.25), rgba(247,106,138,0.25))",
            border: "1px solid rgba(124,106,247,0.4)",
            marginBottom: 28,
          }}
        >
          🌿
        </div>

        {/* タイトル */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            background: "linear-gradient(135deg, #7c6af7, #f76a8a)",
            backgroundClip: "text",
            color: "transparent",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          Nestify
        </div>

        {/* サブタイトル */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(232,230,240,0.5)",
            marginTop: 20,
            letterSpacing: "0.1em",
            fontFamily: "monospace",
          }}
        >
          NESTED PLAYLIST MANAGER
        </div>

        {/* 説明 */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(232,230,240,0.35)",
            marginTop: 28,
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Spotify のプレイリストをフォルダのように無限にネスト管理
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
