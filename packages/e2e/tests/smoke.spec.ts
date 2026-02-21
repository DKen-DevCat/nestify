import { test, expect } from "@playwright/test";

test("フロントエンドが起動している", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(500);
});

test("バックエンドが起動している", async ({ request }) => {
  const res = await request.get("http://localhost:3001/");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.message).toBe("Nestify API");
});
