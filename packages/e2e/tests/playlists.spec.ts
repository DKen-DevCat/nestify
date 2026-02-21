import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH } from "./constants";

test.use({ storageState: AUTH_STATE_PATH });

test.describe("プレイリストツリー", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/playlists");
  });

  test("サイドバーに Nestify ロゴが表示される", async ({ page }) => {
    await expect(page.getByText("Nestify").first()).toBeVisible();
  });

  test("モックのルートプレイリスト『All Music』が表示される", async ({ page }) => {
    await expect(page.getByText("All Music")).toBeVisible();
  });

  test("プレイリストをクリックすると詳細ページに遷移する", async ({ page }) => {
    await page.getByText("All Music").click();
    await expect(page).toHaveURL(/\/playlists\/pl-001/);
  });

  test("プレイリスト詳細ページに曲数が表示される", async ({ page }) => {
    await page.goto("/playlists/pl-001");
    // 曲数 or "曲" テキストが表示される
    await expect(page.getByText(/\d+ 曲/)).toBeVisible();
  });

  test("サイドバーの + ボタンでプレイリスト作成モーダルが開く", async ({ page }) => {
    await page.getByTitle("新しいプレイリストを作成").click();
    // モーダルタイトルは "新しいプレイリスト"
    await expect(page.getByText("新しいプレイリスト")).toBeVisible();
  });

  test("プレイリスト作成モーダルで名前を入力して作成できる", async ({ page }) => {
    await page.getByTitle("新しいプレイリストを作成").click();
    await expect(page.getByText("新しいプレイリスト")).toBeVisible();

    // placeholder は "例: Morning Vibes"
    await page.getByPlaceholder("例: Morning Vibes").fill("テスト用プレイリスト");
    await page.getByRole("button", { name: "作成", exact: true }).click();

    // モーダルが閉じる
    await expect(page.getByText("新しいプレイリスト")).not.toBeVisible({ timeout: 3000 });
  });

  test("プレイリストをクリックすると子が展開される", async ({ page }) => {
    // "All Music" をクリックすると選択 + 展開が同時に起きる（handleSelect 内部で toggleExpand）
    await page.getByText("All Music").click();

    // 子ノード "Lo-fi Beats" が表示される
    await expect(page.getByText("Lo-fi Beats")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("プレイリスト詳細", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/playlists/pl-001");
  });

  test("プレイリスト名がヘッダーに表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "All Music" })).toBeVisible();
  });

  test("「すべて再生」ボタンが存在する", async ({ page }) => {
    await expect(page.getByRole("button", { name: /すべて再生/ })).toBeVisible();
  });

  test("「シャッフル」ボタンが存在する", async ({ page }) => {
    await expect(page.getByRole("button", { name: /シャッフル/ })).toBeVisible();
  });

  test("「Spotify へ書き出し」ボタンが存在する", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Spotify へ書き出し/ })).toBeVisible();
  });

  test("削除ボタンをクリックすると確認ダイアログが表示される", async ({ page }) => {
    // Trash2 アイコンのボタン（aria-label なし、title なし）
    // ゴミ箱アイコンを含むボタンを探す
    const deleteBtn = page.locator("button svg.lucide-trash-2").locator("..");
    await deleteBtn.click();
    await expect(page.getByText("プレイリストを削除")).toBeVisible();
  });

  test("削除ダイアログでキャンセルするとダイアログが閉じる", async ({ page }) => {
    const deleteBtn = page.locator("button svg.lucide-trash-2").locator("..");
    await deleteBtn.click();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByText("プレイリストを削除")).not.toBeVisible({ timeout: 3000 });
  });
});
