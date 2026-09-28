import { execFileSync } from "node:child_process";

import type { FullConfig } from "@playwright/test";

import { closeDb, sql } from "./support/db";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL, SUPER_ADMIN } from "./support/env";

export default async function globalSetup(config: FullConfig) {
  const env = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
    APP_ENV: "development",
    AUTH_SECRET: E2E_AUTH_SECRET,
  };

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env,
    stdio: "inherit",
  });

  await sql('TRUNCATE "invites", "users" RESTART IDENTITY CASCADE');
  await closeDb();

  execFileSync("npm", ["run", "-s", "bootstrap"], {
    env: {
      ...env,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: SUPER_ADMIN.email,
      BOOTSTRAP_SUPER_ADMIN_FIRST_NAME: SUPER_ADMIN.firstName,
      BOOTSTRAP_SUPER_ADMIN_LAST_NAME: SUPER_ADMIN.lastName,
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: SUPER_ADMIN.password,
    },
    stdio: "inherit",
  });

  await assertServerUsesE2eDatabase(config.projects[0].use.baseURL!);
}

// A server on another database would fail every sign-in spec with a misleading message.
async function assertServerUsesE2eDatabase(baseURL: string) {
  const csrf = await fetch(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const cookie = csrf.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const signIn = await fetch(`${baseURL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({
      csrfToken,
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
    }),
  });

  if (!signIn.headers.getSetCookie().some((c) => c.includes("session-token=")))
    throw new Error(
      `The server at ${baseURL} could not sign in the e2e super admin, so it is not using ` +
        `atmo_e2e. Stop it and run \`npm run e2e\` without E2E_PORT to let the suite start its ` +
        `own server.`,
    );
}
