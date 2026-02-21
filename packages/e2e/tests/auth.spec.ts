import { test, expect } from "@playwright/test";

test.describe("認証フロー", () => {
  test("未認証でルートにアクセスすると /login にリダイレクトされる", async ({ page }) => {
    // localStorage が空の新しいコンテキストでアクセス
    await page.goto("/");
    // PlaylistSidebar が token なしを検知して /login へリダイレクト
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("ログインページに Spotify ログインボタンが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Spotify でログイン")).toBeVisible();
  });

  test("開発環境ではモックログインリンクが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("モックデータでログイン")).toBeVisible();
  });

  test("/dev-login にアクセスするとトークンが保存されて /playlists へ遷移する", async ({ page }) => {
    await page.goto("/dev-login");

    // /playlists に遷移するまで待機
    await page.waitForURL(/\/playlists/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/playlists/);

    // localStorage にトークンが保存されている
    const token = await page.evaluate(() => localStorage.getItem("nestify_token"));
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(10);
  });
});
