import type { User } from "@generated/client";

import { email as emailSchema } from "@/lib/schemas/fields";
import { DUMMY_HASH, verifyPassword } from "@/server/auth/password";
import {
  clearFailedSignIns,
  findUserByEmail,
  incrementFailedSignIns,
  lockAccount,
} from "@/server/users/user-repository";

export const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export function isLocked(user: Pick<User, "lockedUntil">, now: Date): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

/** The fifth failure in a row locks; lockAccount resets the count, so expiry starts fresh. */
export async function registerFailedAttempt(
  userId: string,
  now: Date,
): Promise<void> {
  const count = await incrementFailedSignIns(userId);
  if (count >= LOCK_THRESHOLD) {
    await lockAccount(userId, new Date(now.getTime() + LOCK_DURATION_MS));
  }
}

export async function registerSuccessfulAttempt(
  user: Pick<User, "id" | "failedSignInCount" | "lockedUntil">,
): Promise<void> {
  if (user.failedSignInCount > 0 || user.lockedUntil !== null) {
    await clearFailedSignIns(user.id);
  }
}

/** The same null, after the same single comparison, whatever the reason (FR-015). */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const now = new Date();
  const parsed = emailSchema.safeParse(email);
  const user = parsed.success ? await findUserByEmail(parsed.data) : null;

  const matches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user || !user.isActive || user.passwordHash === null) return null;
  // Locked: refused even with the right password, and not counted (FR-019).
  if (isLocked(user, now)) return null;

  if (!matches) {
    await registerFailedAttempt(user.id, now);
    return null;
  }

  await registerSuccessfulAttempt(user);
  return user;
}
