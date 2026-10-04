import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", locale: "id-ID" } },
    { name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium", channel: "chrome", locale: "id-ID" } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname localhost",
    env: { ...process.env, TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB_API_READ_ACCESS_TOKEN || "playwright-test-token" },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
