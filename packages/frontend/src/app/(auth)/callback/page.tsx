import { Suspense } from "react";
import { CallbackHandler } from "./CallbackHandler";

export default function CallbackPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <CallbackHandler />
    </Suspense>
  );
}

function LoadingView() {
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
