import { afterAll, beforeEach } from "vitest";

import { db } from "@/server/db";

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE "invites", "users" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await db.$disconnect();
});
