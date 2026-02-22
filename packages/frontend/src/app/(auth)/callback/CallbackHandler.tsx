"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      router.replace("/login");
      return;
    }

    if (token) {
      localStorage.setItem("nestify_token", token);
      router.replace("/playlists");
    } else {
      router.replace("/login");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div
          className="inline-block w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin"
          aria-label="ログイン処理中"
        />
        <p className="text-foreground/60 text-sm">ログイン中...</p>
      </div>
    </div>
  );
}
