"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function DevLoginClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function login() {
      try {
        const res = await fetch(`${API_URL}/auth/dev-token`);
        const json = (await res.json()) as
          | { ok: true; data: { token: string } }
          | { ok: false; error: string };

        if (!json.ok) {
          setError(json.error);
          return;
        }

        localStorage.setItem("nestify_token", json.data.token);
        router.replace("/playlists");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    }

    login();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-accent-pink text-sm">開発ログイン失敗: {error}</p>
          <p className="text-foreground/40 text-xs">
            バックエンドを <code className="text-accent-green">DB_MODE=mock DEV_BYPASS_AUTH=true</code> で起動してください
          </p>
          <a
            href="/login"
            className="text-accent-purple text-sm underline"
          >
            通常ログインへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-block w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground/60 text-sm">開発ログイン中...</p>
      </div>
    </div>
  );
}
