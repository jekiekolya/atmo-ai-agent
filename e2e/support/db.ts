import bcrypt from "bcryptjs";
import pg from "pg";

import { E2E_DATABASE_URL } from "./env";

// Plain pg, not Prisma: its generated client uses import.meta, which Playwright cannot load.
const pool = new pg.Pool({ connectionString: E2E_DATABASE_URL, max: 2 });

export function sql(text: string, values: unknown[] = []) {
  return pool.query(text, values);
}

export async function closeDb() {
  await pool.end();
}

let counter = 0;

/** An active admin of the spec's own, so specs never share a session owner. */
export async function createAdmin(overrides: { password?: string } = {}) {
  counter += 1;
  const password = overrides.password ?? "e2e admin password";
  const email = `admin-${process.pid}-${Date.now()}-${counter}@e2e.test`;
  // Cost 4: fixture speed; the application's own hashes stay at 12.
  const passwordHash = await bcrypt.hash(password, 4);

  const { rows } = await sql(
    `INSERT INTO users (id, email, "firstName", "lastName", role, "passwordHash", "passwordChangedAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, 'Taras', 'Shevchenko', 'ADMIN', $2, now() - interval '1 minute', now())
     RETURNING id`,
    [email, passwordHash],
  );

  return { id: rows[0].id as string, email, password };
}
