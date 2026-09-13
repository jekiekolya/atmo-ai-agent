import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Tests live next to the code they cover, so the environment is split by file
// suffix, not directory. e2e/ is excluded — Playwright owns those files.
const exclude = ["e2e/**", "node_modules/**", ".next/**"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/{config,i18n,lib,services}/**/*.test.ts"],
          exclude,
          // Neither has a default and CI has no .env file, so Config would
          // fail fast on import. Same values as playwright.config.ts; the URL
          // is a placeholder, no unit test connects.
          env: {
            APP_ENV: "development",
            DATABASE_URL: "postgresql://user:password@localhost:5432/atmo_dev",
          },
          // next-intl imports `next/server` extensionless and `next` has no
          // exports map, so Node's ESM resolver needs Vite to transform it.
          server: { deps: { inline: ["next-intl"] } },
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
