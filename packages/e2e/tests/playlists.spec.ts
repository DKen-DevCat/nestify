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

  test("跨ぎDnD直後に書き出しても、移動保存完了後に export が実行される", async ({ page }) => {
    let moveRequested = false;
    let releaseMoveRequest!: () => void;
    const moveGate = new Promise<void>((resolve) => {
      releaseMoveRequest = resolve;
    });

    let exportRequestCount = 0;

    await page.route("**/api/playlists/*/tracks/*/move", async (route) => {
      moveRequested = true;
      await moveGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { moved: true } }),
      });
    });

    await page.route("**/api/playlists/*/items/reorder", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { reordered: true } }),
      });
    });

    await page.route("**/api/spotify/export-tree/*", async (route) => {
      exportRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: {} }),
      });
    });

    await page.goto("/playlists/pl-001");

    const sourceRow = page.locator("li", { hasText: "Rainy Day" }).first();
    const targetRow = page.locator("li", { hasText: "Midnight Blue" }).first();
    await expect(sourceRow).toBeVisible();
    await expect(targetRow).toBeVisible();

    const sourceHandle = sourceRow.locator("span.cursor-grab").first();
    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetRow.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!sourceBox || !targetBox) return;

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();

    await expect.poll(() => moveRequested).toBe(true);

    // move が未完了の時点で export を押しても、実リクエストは待機すること
    await page.getByRole("button", { name: /Spotify へ書き出し/ }).first().click();
    await page.waitForTimeout(300);
    expect(exportRequestCount).toBe(0);

    releaseMoveRequest();
    await expect.poll(() => exportRequestCount).toBe(1);
  });
});
