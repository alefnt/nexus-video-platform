// FILE: /video-platform/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  webServer: {
    command: "npm run dev",
    cwd: "./client-web",
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    headless: true,
    baseURL: "http://localhost:5173",
  },
});