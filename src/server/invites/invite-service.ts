import { type Actor, assertSuperAdmin } from "@/server/auth/authorization";
import { hashPassword } from "@/server/auth/password";
import { type Db, db } from "@/server/db";
import { ConflictError, GoneError, InvalidInviteError } from "@/server/errors";
import {
  consumeInvite,
  findInviteByTokenHash,
  insertInvite,
  type InviteWithUser,
  revokeOutstandingInvites,
} from "@/server/invites/invite-repository";
import {
  generateInviteToken,
  hashInviteToken,
  isWellFormedToken,
} from "@/server/invites/invite-token";
import { isUniqueViolation } from "@/server/prisma-errors";
import { existingUser } from "@/server/users/existing-user";
import { setPassword } from "@/server/users/user-repository";

export const INVITE_LIFETIME_MS = 72 * 60 * 60 * 1000;

export type IssuedInvite = { token: string; expiresAt: Date };

export type InviteOutcome =
  | { status: "valid"; email: string }
  | { status: "invalid" }
  | { status: "used" }
  | { status: "expired" };

/** Supersedes any outstanding invite. The plain token leaves only here. */
export async function issueInviteFor(
  userId: string,
  issuedById: string,
  client: Db,
): Promise<IssuedInvite> {
  const now = new Date();
  const token = generateInviteToken();
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_MS);

  await revokeOutstandingInvites(userId, now, client);
  await insertInvite(
    { userId, issuedById, tokenHash: hashInviteToken(token), expiresAt },
    client,
  );

  return { token, expiresAt };
}

// Revoked is checked first, so a revoked link tells its holder no more than a forged one.
function outcomeOf(invite: InviteWithUser | null, now: Date): InviteOutcome {
  if (!invite || invite.revokedAt || !invite.user.isActive) {
    return { status: "invalid" };
  }
  if (invite.consumedAt) return { status: "used" };
  if (invite.expiresAt <= now) return { status: "expired" };
  return { status: "valid", email: invite.user.email };
}

async function findByToken(token: string, client: Db = db) {
  if (!isWellFormedToken(token)) return null;
  return findInviteByTokenHash(hashInviteToken(token), client);
}

export async function inspectInvite(token: string): Promise<InviteOutcome> {
  return outcomeOf(await findByToken(token), new Date());
}

function throwFor(outcome: InviteOutcome): never {
  if (outcome.status === "used") throw new ConflictError("invite_used");
  if (outcome.status === "expired") throw new GoneError("invite_expired");
  throw new InvalidInviteError();
}

export async function acceptInvite(input: {
  token: string;
  password: string;
}): Promise<void> {
  const invite = await findByToken(input.token);
  const outcome = outcomeOf(invite, new Date());
  if (outcome.status !== "valid" || !invite) throwFor(outcome);

  // Hashed before the transaction: bcrypt is slow and holds no locks.
  const passwordHash = await hashPassword(input.password);

  await db.$transaction(async (tx) => {
    const now = new Date();
    if (!(await consumeInvite(invite.id, now, tx))) {
      throwFor(outcomeOf(await findByToken(input.token, tx), now));
    }

    await setPassword(invite.userId, passwordHash, now, tx);
  });
}

/** The current password keeps working until the new link is used (FR-050). */
export async function issueInvite(
  actor: Actor,
  userId: string,
): Promise<IssuedInvite> {
  assertSuperAdmin(actor);
  const target = await existingUser(userId);
  if (target.role === "SUPER_ADMIN") {
    throw new ConflictError("invite_not_allowed", "super_admin");
  }
  if (!target.isActive) {
    throw new ConflictError("invite_not_allowed", "deactivated");
  }

  try {
    return await db.$transaction((tx) => issueInviteFor(userId, actor.id, tx));
  } catch (error) {
    // A double click or a second tab issued one first.
    if (isUniqueViolation(error, "invites_one_outstanding_per_user")) {
      throw new ConflictError("invite_issued_concurrently");
    }
    throw error;
  }
}

export async function revokeInvite(
  actor: Actor,
  userId: string,
): Promise<void> {
  assertSuperAdmin(actor);
  await existingUser(userId);

  if ((await revokeOutstandingInvites(userId, new Date())) === 0) {
    throw new ConflictError("no_outstanding_invite");
  }
}
