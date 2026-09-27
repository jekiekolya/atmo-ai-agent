import { type Db, db } from "@/server/db";
import type { Role, User } from "@generated/client";

export type { Role, User };

export type UserStatus = "invited" | "active" | "deactivated";

/** What leaves the service layer. Never carries the password hash. */
export type UserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

export function statusOf(
  user: Pick<User, "isActive" | "passwordHash">,
): UserStatus {
  if (!user.isActive) return "deactivated";
  return user.passwordHash === null ? "invited" : "active";
}

export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: statusOf(user),
    createdAt: user.createdAt,
  };
}

export function findUserById(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

/** `email` must already be normalized by the shared email schema. */
export function findUserByEmail(email: string): Promise<User | null> {
  return db.user.findUnique({ where: { email } });
}

export function findSuperAdmin(): Promise<User | null> {
  return db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
}

export function insertSuperAdmin(data: {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  passwordChangedAt: Date;
}): Promise<User> {
  return db.user.create({ data: { ...data, role: "SUPER_ADMIN" } });
}

export async function setSignedOutAt(
  id: string,
  at: Date,
  client: Db = db,
): Promise<void> {
  await client.user.update({ where: { id }, data: { signedOutAt: at } });
}

export function insertAdmin(
  data: { email: string; firstName: string; lastName: string },
  client: Db = db,
): Promise<User> {
  return client.user.create({ data: { ...data, role: "ADMIN" } });
}

export type UserListItem = UserSummary & {
  pendingInvite: { expiresAt: Date } | null;
};

export async function listUsersWithPendingInvite(): Promise<UserListItem[]> {
  const users = await db.user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      invites: {
        where: { consumedAt: null, revokedAt: null },
        select: { expiresAt: true },
        take: 1,
      },
    },
  });

  return users.map(({ invites, ...user }) => ({
    ...toUserSummary(user),
    pendingInvite: invites[0] ?? null,
  }));
}

export function setActive(
  id: string,
  isActive: boolean,
  client: Db = db,
): Promise<User> {
  return client.user.update({ where: { id }, data: { isActive } });
}

/** Atomic, so concurrent failures are all counted. Returns the new count. */
export async function incrementFailedSignIns(id: string): Promise<number> {
  const { failedSignInCount } = await db.user.update({
    where: { id },
    data: { failedSignInCount: { increment: 1 } },
    select: { failedSignInCount: true },
  });
  return failedSignInCount;
}

export async function lockAccount(id: string, until: Date): Promise<void> {
  await db.user.update({
    where: { id },
    data: { lockedUntil: until, failedSignInCount: 0 },
  });
}

export async function clearFailedSignIns(id: string): Promise<void> {
  await db.user.update({
    where: { id },
    data: { failedSignInCount: 0, lockedUntil: null },
  });
}

export async function setPassword(
  id: string,
  passwordHash: string,
  at: Date,
  client: Db = db,
): Promise<void> {
  await client.user.update({
    where: { id },
    data: {
      passwordHash,
      passwordChangedAt: at,
      failedSignInCount: 0,
      lockedUntil: null,
    },
  });
}
