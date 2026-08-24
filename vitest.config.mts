import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Tests live next to the code they cover, so the environment cannot be split by
// directory alone: domain code must run in node, where process.env and Node-only
// failures behave for real, while component tests need a DOM.
// e2e/ is excluded because Playwright owns those files — run under Vitest they
// collide on `expect`.
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
          // APP_ENV has no default and CI has no .env file, so the Config
          // module would fail fast the moment a test imports it. Same reason
          // and same value as playwright.config.ts. Tooling configs may read
          // and set process.env (Constitution, Principle V).
          env: { APP_ENV: "development" },
          // next-intl ships ESM that imports `next/server` extensionless, and
          // `next` publishes no exports map, so Node's strict ESM resolver
          // cannot find it. Letting Vite transform the package instead of
          // externalising it resolves the specifier the way the bundler does.
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
