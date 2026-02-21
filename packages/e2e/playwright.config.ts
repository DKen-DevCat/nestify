import { defineConfig, devices } from "@playwright/test";

const CHROMIUM_EXEC = `${__dirname}/.playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["line"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    // 1. 認証セットアップ（他のプロジェクトより先に実行）
    {
      name: "setup",
      testMatch: "**/setup/auth.setup.ts",
      use: {
        ...devices["Desktop Chrome"],
        executablePath: CHROMIUM_EXEC,
      },
    },

    // 2. 認証不要なテスト
    {
      name: "unauthenticated",
      testMatch: ["**/smoke.spec.ts", "**/auth.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        executablePath: CHROMIUM_EXEC,
      },
    },

    // 3. 認証済みテスト（setup に依存）
    {
      name: "authenticated",
      testMatch: "**/playlists.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        executablePath: CHROMIUM_EXEC,
        storageState: ".auth/user.json",
      },
    },
  ],
});
