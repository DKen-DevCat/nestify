/**
 * 認証済みセッションのセットアップ
 * dev-login でトークンを取得し storageState に保存する。
 * playlist.spec.ts など認証が必要なテストが依存する。
 */
import { test as setup } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { AUTH_STATE_PATH } from "../constants";

setup("認証済みセッションを準備", async ({ page }) => {
  await page.goto("/dev-login");
  await page.waitForURL(/\/playlists/, { timeout: 8000 });

  // storageState を保存
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
