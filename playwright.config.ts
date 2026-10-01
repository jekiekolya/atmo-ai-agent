import { defineConfig, devices } from "@playwright/test";

import { E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./e2e/support/env";

// Tooling config, so it reads process.env. E2E_PORT reuses a running server (see global setup).
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    // APP_ENV and DATABASE_URL have no defaults and CI has no .env file.
    // Never staging or production: the suite must not resolve to real
    // infrastructure.
    env: {
      PORT: String(port),
      APP_ENV: "development",
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
    },
    url: baseURL,
    // A cold production build runs well past Playwright's 60s default.
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
