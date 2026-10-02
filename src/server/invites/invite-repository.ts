import { type Db, db } from "@/server/db";
import type { Invite, Prisma, User } from "@generated/client";

export type InviteWithUser = Invite & { user: User };

/** Neither used nor revoked; an expired invite still counts. */
export const OUTSTANDING_INVITE = {
  consumedAt: null,
  revokedAt: null,
} satisfies Prisma.InviteWhereInput;

export function insertInvite(
  data: {
    userId: string;
    issuedById: string;
    tokenHash: string;
    expiresAt: Date;
  },
  client: Db = db,
): Promise<Invite> {
  return client.invite.create({ data });
}

export function findInviteByTokenHash(
  tokenHash: string,
  client: Db = db,
): Promise<InviteWithUser | null> {
  return client.invite.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export function findOutstandingInvite(
  userId: string,
  client: Db = db,
): Promise<Invite | null> {
  return client.invite.findFirst({
    where: { userId, ...OUTSTANDING_INVITE },
  });
}

export async function revokeOutstandingInvites(
  userId: string,
  at: Date,
  client: Db = db,
): Promise<number> {
  const { count } = await client.invite.updateMany({
    where: { userId, ...OUTSTANDING_INVITE },
    data: { revokedAt: at },
  });
  return count;
}

/** Of two concurrent submissions only one matches this guarded update (FR-045). */
export async function consumeInvite(
  id: string,
  at: Date,
  client: Db = db,
): Promise<boolean> {
  const { count } = await client.invite.updateMany({
    where: { id, ...OUTSTANDING_INVITE, expiresAt: { gt: at } },
    data: { consumedAt: at },
  });
  return count === 1;
}
