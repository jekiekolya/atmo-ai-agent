import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { INTEGRATION_DATABASE_URL } from "./vitest.integration.env";

// Tests live next to the code they cover, so the environment is split by file
// suffix, not directory. e2e/ is excluded — Playwright owns those files.
const exclude = ["e2e/**", "node_modules/**", ".next/**"];

// Config fails fast without these, and CI has no .env file.
const testEnv = {
  APP_ENV: "development",
  AUTH_SECRET: "test-secret-at-least-32-characters-long",
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/{config,i18n,lib,services,server,auth}/**/*.test.ts"],
          exclude: [...exclude, "**/*.integration.test.ts"],
          // A database that does not exist, so a unit test that queries fails loudly.
          env: {
            ...testEnv,
            DATABASE_URL:
              "postgresql://atmo:atmo@localhost:5432/atmo_unit_no_db",
          },
          // next-intl imports `next/server` extensionless and `next` has no
          // exports map, so Node's ESM resolver needs Vite to transform it.
          server: { deps: { inline: ["next-intl", "next-auth"] } },
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          environment: "node",
          include: [
            "src/**/*.integration.test.ts",
            "scripts/**/*.integration.test.ts",
          ],
          exclude,
          // A database of its own, so a run never touches atmo_dev.
          env: {
            ...testEnv,
            DATABASE_URL: INTEGRATION_DATABASE_URL,
          },
          globalSetup: ["./vitest.integration.global-setup.ts"],
          setupFiles: ["./vitest.integration.setup.ts"],
          // Every file truncates the same tables.
          fileParallelism: false,
          server: { deps: { inline: ["next-intl", "next-auth"] } },
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/{components,app}/**/*.test.tsx"],
          exclude,
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
