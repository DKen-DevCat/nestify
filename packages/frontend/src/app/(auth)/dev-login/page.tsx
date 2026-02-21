/**
 * 開発用自動ログインページ
 * DEV_BYPASS_AUTH=true かつ DB_MODE=mock のバックエンドに対して、
 * mock JWT を取得して localStorage に保存し /playlists へリダイレクトする。
 *
 * 本番環境では使用しないこと。
 */
import { redirect } from "next/navigation";
import { DevLoginClient } from "./DevLoginClient";

export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/login");
  }

  return <DevLoginClient />;
}
