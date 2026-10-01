import type { User } from "@generated/client";

import { email as emailSchema } from "@/lib/schemas/fields";
import { DUMMY_HASH, verifyPassword } from "@/server/auth/password";
import {
  clearFailedSignIns,
  countSignInAttempt,
  findUserByEmail,
  lockAccount,
} from "@/server/users/user-repository";

export const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Takes one of the five tries before the password is compared, so simultaneous
 * attempts cannot all see an unlocked account. false while locked (FR-018, FR-019).
 */
export async function claimAttempt(
  userId: string,
  now: Date,
): Promise<boolean> {
  const count = await countSignInAttempt(userId, now);
  if (count === null) return false;

  // Every claim past the threshold locks, so a lock lost to a crash is restored by the next try.
  if (count >= LOCK_THRESHOLD) {
    await lockAccount(userId, new Date(now.getTime() + LOCK_DURATION_MS));
  }
  return count <= LOCK_THRESHOLD;
}

/** The same null, after the same single comparison, whatever the reason (FR-015). */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const now = new Date();
  const parsed = emailSchema.safeParse(email);
  const user = parsed.success ? await findUserByEmail(parsed.data) : null;

  // Locked: refused even with the right password, and not counted (FR-019).
  const claimed =
    user !== null &&
    user.isActive &&
    user.passwordHash !== null &&
    (await claimAttempt(user.id, now));

  const matches = await verifyPassword(
    password,
    claimed && user.passwordHash !== null ? user.passwordHash : DUMMY_HASH,
  );
  if (!claimed || !matches) return null;

  await clearFailedSignIns(user.id);
  return user;
}
