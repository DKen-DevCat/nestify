import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
  description:
    "Spotify アカウントでログインして、ネスト型プレイリスト管理を始めましょう。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Nestify — ログイン",
    description:
      "Spotify アカウントでログインして、ネスト型プレイリスト管理を始めましょう。",
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const IS_DEV = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center overflow-hidden">
      {/* アニメーション背景オーブ */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none animate-orb-drift"
        style={{
          background: "radial-gradient(circle, rgba(124,106,247,0.18) 0%, transparent 70%)",
          top: "-15%",
          left: "-10%",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-orb-drift-reverse"
        style={{
          background: "radial-gradient(circle, rgba(247,106,138,0.14) 0%, transparent 70%)",
          bottom: "-10%",
          right: "-8%",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(106,247,200,0.08) 0%, transparent 70%)",
          top: "40%",
          right: "20%",
          filter: "blur(40px)",
          animation: "orb-drift 28s ease-in-out infinite",
        }}
      />

      {/* ノイズテクスチャオーバーレイ（軽微） */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* メインコンテンツ */}
      <div className="relative z-10 text-center flex flex-col items-center gap-10 animate-fade-in-up px-6">
        {/* ロゴ */}
        <div className="space-y-3">
          <div className="flex items-center justify-center mb-6">
            <svg
              width="56"
              height="56"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ boxShadow: "0 0 32px rgba(124,106,247,0.45)", borderRadius: "14px" }}
            >
              <defs>
                <linearGradient id="logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c6af7" />
                  <stop offset="1" stopColor="#f76a8a" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
              <rect x="6"  y="8"    width="20" height="3.5" rx="1.75" fill="white" opacity="0.95" />
              <rect x="10" y="14.5" width="14" height="3"   rx="1.5"  fill="white" opacity="0.75" />
              <rect x="14" y="20.5" width="9"  height="3"   rx="1.5"  fill="white" opacity="0.55" />
            </svg>
          </div>

          <h1
            className="font-[family-name:var(--font-syne)] text-6xl font-bold tracking-tight text-gradient"
          >
            Nestify
          </h1>
          <p className="text-foreground/40 text-sm tracking-widest uppercase font-[family-name:var(--font-space-mono)]">
            Nested Playlist Manager
          </p>
        </div>

        {/* 説明テキスト */}
        <p className="text-foreground/50 text-sm max-w-xs leading-relaxed">
          Spotify のプレイリストをフォルダのように、<br />
          無限にネストして管理する。
        </p>

        {/* ログインボタン */}
        <div className="flex flex-col items-center gap-4">
          <form action={`${API_URL}/auth/login`} method="GET">
            <button
              type="submit"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-white overflow-hidden transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #7c6af7, #f76a8a)",
                boxShadow: "0 0 30px rgba(124,106,247,0.35), 0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              {/* シマーエフェクト */}
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
              <SpotifyIcon />
              <span className="relative">Spotify でログイン</span>
            </button>
          </form>

          <p className="text-foreground/25 text-xs">
            ログインにより Spotify の利用規約に同意したとみなされます
          </p>
        </div>

        {/* 開発用ショートカット */}
        {IS_DEV && (
          <div className="pt-2 border-t border-white/5 w-full">
            <p className="text-foreground/15 text-xs mb-2 font-[family-name:var(--font-space-mono)]">
              DEV
            </p>
            <a
              href="/dev-login"
              className="text-accent-green text-xs opacity-40 hover:opacity-80 transition-opacity font-[family-name:var(--font-space-mono)]"
            >
              → モックデータでログイン
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="relative"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
