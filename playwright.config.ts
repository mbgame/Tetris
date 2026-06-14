import { defineConfig } from "@playwright/test";

/** E2E config. Specs live in e2e/ (separate from vitest's tests/). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/play",
    reuseExistingServer: true,
    timeout: 90000,
  },
});
