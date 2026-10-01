import { execFileSync } from "node:child_process";

import { INTEGRATION_DATABASE_URL } from "./vitest.integration.env";

// Tooling file, so it reads process.env; migrate deploy creates the database on first run.
export default function setup() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: INTEGRATION_DATABASE_URL },
    stdio: "inherit",
  });
}
