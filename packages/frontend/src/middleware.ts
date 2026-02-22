import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cookie の nestify_token を確認してルーティングを制御する。
 * - /playlists/** → 未認証なら /login へ
 * - /login       → 認証済みなら /playlists へ
 * - /            → 認証状態に応じてリダイレクト
 *
 * ※ JWT の検証はしない（有効期限切れは API 側の 401 で検知）
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("nestify_token")?.value;
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(token);

  // / → 認証状態に応じてリダイレクト
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/playlists" : "/login", request.url),
    );
  }

  // /playlists/** → 未認証なら /login へ
  if (pathname.startsWith("/playlists") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // /login → 認証済みなら /playlists へ（フラッシュ防止）
  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/playlists", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/playlists/:path*"],
};
