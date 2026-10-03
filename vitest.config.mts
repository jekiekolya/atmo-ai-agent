import { readFileSync } from "node:fs";
import { basename } from "node:path";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, type Plugin } from "vitest/config";

import { INTEGRATION_DATABASE_URL } from "./vitest.integration.env";

// Next imports an .svg as { src, width, height }; Vite would give a bare URL string.
const nextStaticSvg: Plugin = {
  name: "next-static-svg",
  enforce: "pre",
  load(id) {
    const file = id.split("?")[0];
    if (!file.endsWith(".svg")) return null;

    const root = readFileSync(file, "utf8").match(/<svg\b[^>]*>/)?.[0] ?? "";
    const attribute = (name: string) =>
      root.match(new RegExp(`\\s${name}="([\\d.]+)"`))?.[1];
    const viewBox = root.match(/\sviewBox="([^"]+)"/)?.[1].split(/[\s,]+/);
    const width = Number(attribute("width") ?? viewBox?.[2]);
    const height = Number(attribute("height") ?? viewBox?.[3]);

    return `export default ${JSON.stringify({ src: `/${basename(file)}`, width, height })};`;
  },
};

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
          include: [
            "src/{config,conventions,i18n,lib,server,auth}/**/*.test.ts",
          ],
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
        plugins: [tsconfigPaths(), react(), nextStaticSvg],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/{components,app,i18n}/**/*.test.tsx"],
          exclude,
          setupFiles: ["./vitest.setup.ts"],
          // A non-UTC zone, so a date that silently assumes UTC fails on a UTC CI runner too.
          env: { TZ: "Europe/Kyiv" },
        },
      },
    ],
  },
});
