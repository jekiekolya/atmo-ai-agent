import { db } from "@/server/db";
import type { Role } from "@generated/client";

// Integration-test fixtures. Hashes are placeholders unless a test signs in.
export async function createUserRow(
  overrides: Partial<{
    email: string;
    role: Role;
    isActive: boolean;
    passwordHash: string | null;
    createdAt: Date;
  }> = {},
) {
  return db.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@example.com`,
      firstName: "Taras",
      lastName: "Shevchenko",
      role: "ADMIN",
      passwordHash: "placeholder",
      ...overrides,
    },
  });
}

export function createSuperAdminRow() {
  return createUserRow({ email: "owner@example.com", role: "SUPER_ADMIN" });
}

export const actorOf = (user: { id: string; role: Role }) => ({
  id: user.id,
  role: user.role,
});
