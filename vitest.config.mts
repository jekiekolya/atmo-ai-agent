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
          include: ["src/{config,lib,services}/**/*.test.ts"],
          exclude,
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
