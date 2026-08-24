import { defineConfig, devices } from "@playwright/test";

// E2E_PORT points the suite at a server that is already running — typically the
// dev server you have open, which is the fast local loop: Next allows only one
// dev server per directory, so the suite cannot start a second one. Without it
// the suite builds and serves the production bundle itself, the way CI does.
// Tooling configs may read process.env directly (Constitution, Principle V).
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    // APP_ENV has no default and CI has no .env file. Never staging or
    // production: the suite must not resolve to real infrastructure.
    env: { PORT: String(port), APP_ENV: "development" },
    url: baseURL,
    // A cold production build runs well past Playwright's 60s default.
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
