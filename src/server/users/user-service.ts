import { claimAttempt } from "@/server/auth/authenticate";
import { type Actor, assertSuperAdmin } from "@/server/auth/authorization";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { ConflictError, LockedError, ValidationError } from "@/server/errors";
import { revokeOutstandingInvites } from "@/server/invites/invite-repository";
import {
  type IssuedInvite,
  issueInviteFor,
} from "@/server/invites/invite-service";
import { isUniqueViolation } from "@/server/prisma-errors";
import { existingUser } from "@/server/users/existing-user";
import {
  findSuperAdmin,
  findUserByEmail,
  insertAdmin,
  insertSuperAdmin,
  listUsersWithPendingInvite,
  setActive,
  setPassword,
  setSignedOutAt,
  toUserSummary,
  type UserListItem,
  type UserSummary,
} from "@/server/users/user-repository";

export type BootstrapInput = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

export type BootstrapResult =
  | { outcome: "created"; email: string }
  | { outcome: "exists"; email: string }
  | { outcome: "email_taken"; email: string };

/** When a super admin exists, nothing is read or written, not even the password (FR-009). */
export async function bootstrapSuperAdmin(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const existing = await findSuperAdmin();
  if (existing) return { outcome: "exists", email: existing.email };

  try {
    const created = await insertSuperAdmin({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
    });
    return { outcome: "created", email: created.email };
  } catch (error) {
    const isEmailClash = isUniqueViolation(error, "users_email_key");
    if (!isEmailClash && !isUniqueViolation(error, "users_one_super_admin")) {
      throw error;
    }

    // A concurrent run may have won with the same email; that is "exists".
    const winner = await findSuperAdmin();
    if (winner) return { outcome: "exists", email: winner.email };
    return { outcome: "email_taken", email: input.email };
  }
}

/** Ends every session of the actor, on every device (FR-066). */
export async function recordSignOut(actor: Actor): Promise<void> {
  await setSignedOutAt(actor.id, new Date());
}

async function emailInUse(email: string): Promise<ConflictError> {
  const holder = await findUserByEmail(email);
  return new ConflictError(
    "email_in_use",
    holder && !holder.isActive ? "deactivated" : undefined,
  );
}

/** A new admin with no password, and the one invite that lets them set it. */
export async function createUser(
  actor: Actor,
  input: { email: string; firstName: string; lastName: string; role: "ADMIN" },
): Promise<{ user: UserSummary; invite: IssuedInvite }> {
  assertSuperAdmin(actor);

  if (await findUserByEmail(input.email)) throw await emailInUse(input.email);

  try {
    return await db.$transaction(async (tx) => {
      const user = await insertAdmin(
        {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
        },
        tx,
      );
      const invite = await issueInviteFor(user.id, actor.id, tx);
      return { user: toUserSummary(user), invite };
    });
  } catch (error) {
    // Lost a race for the same address.
    if (isUniqueViolation(error, "users_email_key")) {
      throw await emailInUse(input.email);
    }
    throw error;
  }
}

export async function listUsers(actor: Actor): Promise<UserListItem[]> {
  assertSuperAdmin(actor);
  return listUsersWithPendingInvite();
}

/** A flag, never a delete; ends the user's sessions on their next request. */
export async function deactivateUser(
  actor: Actor,
  userId: string,
): Promise<UserSummary> {
  assertSuperAdmin(actor);
  const target = await existingUser(userId);
  if (target.role === "SUPER_ADMIN") {
    throw new ConflictError("cannot_deactivate_super_admin");
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    await revokeOutstandingInvites(userId, now, tx);
    await setSignedOutAt(userId, now, tx);
    return setActive(userId, false, tx);
  });
  return toUserSummary(updated);
}

export async function reactivateUser(
  actor: Actor,
  userId: string,
): Promise<UserSummary> {
  assertSuperAdmin(actor);
  await existingUser(userId);
  return toUserSummary(await setActive(userId, true));
}

/** Ends every session, this one included (FR-025); a wrong password counts toward the lock. */
export async function changeOwnPassword(
  actor: Actor,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const now = new Date();
  const user = await existingUser(actor.id);
  // Claimed before the comparison, as for sign-in, so a burst gets five tries at most.
  if (!(await claimAttempt(user.id, now))) throw new LockedError();

  const matches =
    user.passwordHash !== null &&
    (await verifyPassword(input.currentPassword, user.passwordHash));

  if (!matches) {
    throw new ValidationError({
      currentPassword: ["account.currentPasswordWrong"],
    });
  }

  await setPassword(user.id, await hashPassword(input.newPassword), now);
}
