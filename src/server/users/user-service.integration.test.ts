import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";
import { evaluateSession } from "@/server/auth/session-policy";
import { db } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { inspectInvite, issueInviteFor } from "@/server/invites/invite-service";
import {
  actorOf,
  createSuperAdminRow,
  createUserRow,
} from "@/server/testing/fixtures";
import {
  changeOwnPassword,
  createUser,
  deactivateUser,
  listUsers,
  reactivateUser,
  recordSignOut,
} from "@/server/users/user-service";

const policy = { absoluteLifetimeMs: 86_400_000 };

function createAdmin() {
  return db.user.create({
    data: {
      email: "olena@example.com",
      firstName: "Olena",
      lastName: "Kovalenko",
      role: "ADMIN",
      passwordHash: "x",
    },
  });
}

describe("recordSignOut (FR-066)", () => {
  it("stamps the sign-out moment and so ends every earlier session", async () => {
    const admin = await createAdmin();
    const earlier = { authTime: Date.now() - 1_000 };

    await recordSignOut({ id: admin.id, role: admin.role });

    const stored = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(stored.signedOutAt).toBeInstanceOf(Date);
    expect(evaluateSession(earlier, stored, new Date(), policy)).toBeNull();
  });
});

describe("createUser (FR-048, FR-049, FR-039)", () => {
  const input = {
    email: "new@example.com",
    firstName: "Lesya",
    lastName: "Ukrainka",
    role: "ADMIN" as const,
  };

  it("creates an invited admin with a 72-hour invite and returns the token once", async () => {
    const owner = await createSuperAdminRow();

    const result = await createUser(actorOf(owner), input);

    expect(result.user).toMatchObject({
      email: "new@example.com",
      role: "ADMIN",
      status: "invited",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(await inspectInvite(result.invite.token)).toEqual({
      status: "valid",
      email: "new@example.com",
    });
  });

  it("refuses an address held by an active account", async () => {
    const owner = await createSuperAdminRow();
    await createUserRow({ email: "new@example.com" });

    const error = await createUser(actorOf(owner), input).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: "email_in_use", detail: undefined });
  });

  it("points to reactivation when the holder is deactivated", async () => {
    const owner = await createSuperAdminRow();
    await createUserRow({ email: "new@example.com", isActive: false });

    await expect(createUser(actorOf(owner), input)).rejects.toMatchObject({
      code: "email_in_use",
      detail: "deactivated",
    });
  });

  it("refuses an admin actor", async () => {
    const admin = await createUserRow();

    await expect(createUser(actorOf(admin), input)).rejects.toThrow(
      ForbiddenError,
    );
    expect(await db.user.count()).toBe(1);
  });
});

describe("listUsers (FR-047)", () => {
  it("lists everyone newest first, with status and pending invite, never the hash", async () => {
    const owner = await createSuperAdminRow();
    const old = await createUserRow({
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const invited = await createUserRow({ passwordHash: null });
    const gone = await createUserRow({ isActive: false });
    const { expiresAt } = await db.$transaction((tx) =>
      issueInviteFor(invited.id, owner.id, tx),
    );

    const list = await listUsers(actorOf(owner));

    expect(list.map((u) => u.id)).toEqual([
      gone.id,
      invited.id,
      owner.id,
      old.id,
    ]);
    expect(list.find((u) => u.id === invited.id)).toMatchObject({
      status: "invited",
      pendingInvite: { expiresAt },
    });
    expect(list.find((u) => u.id === gone.id)).toMatchObject({
      status: "deactivated",
      pendingInvite: null,
    });
    expect(list.find((u) => u.id === old.id)).toMatchObject({
      status: "active",
    });
    expect(JSON.stringify(list)).not.toContain("passwordHash");
  });

  it("refuses an admin", async () => {
    const admin = await createUserRow();
    await expect(listUsers(actorOf(admin))).rejects.toThrow(ForbiddenError);
  });
});

describe("deactivateUser / reactivateUser (FR-053, FR-054, FR-003)", () => {
  it("deactivates, revokes the outstanding invite, and is idempotent", async () => {
    const owner = await createSuperAdminRow();
    const target = await createUserRow({ passwordHash: null });
    const { token } = await db.$transaction((tx) =>
      issueInviteFor(target.id, owner.id, tx),
    );

    expect((await deactivateUser(actorOf(owner), target.id)).status).toBe(
      "deactivated",
    );
    expect((await deactivateUser(actorOf(owner), target.id)).status).toBe(
      "deactivated",
    );
    expect(await db.invite.count({ where: { revokedAt: null } })).toBe(0);
    expect(await inspectInvite(token)).toEqual({ status: "invalid" });
  });

  it("ends earlier sessions for good, so reactivation does not revive them (FR-023)", async () => {
    const owner = await createSuperAdminRow();
    const target = await createUserRow();
    const earlier = { authTime: Date.now() - 1_000 };

    await deactivateUser(actorOf(owner), target.id);
    await reactivateUser(actorOf(owner), target.id);

    const stored = await db.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(evaluateSession(earlier, stored, new Date(), policy)).toBeNull();
    expect(
      evaluateSession({ authTime: Date.now() }, stored, new Date(), policy),
    ).not.toBeNull();
  });

  it("never deactivates the super admin", async () => {
    const owner = await createSuperAdminRow();

    await expect(
      deactivateUser(actorOf(owner), owner.id),
    ).rejects.toMatchObject({
      code: "cannot_deactivate_super_admin",
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).isActive,
    ).toBe(true);
  });

  it("reactivates to active or invited depending on the password, idempotently", async () => {
    const owner = await createSuperAdminRow();
    const withPassword = await createUserRow({ isActive: false });
    const withoutPassword = await createUserRow({
      isActive: false,
      passwordHash: null,
    });

    expect((await reactivateUser(actorOf(owner), withPassword.id)).status).toBe(
      "active",
    );
    expect((await reactivateUser(actorOf(owner), withPassword.id)).status).toBe(
      "active",
    );
    expect(
      (await reactivateUser(actorOf(owner), withoutPassword.id)).status,
    ).toBe("invited");
  });

  it("reports an unknown account", async () => {
    const owner = await createSuperAdminRow();
    const unknown = "00000000-0000-7000-8000-000000000000";

    await expect(deactivateUser(actorOf(owner), unknown)).rejects.toThrow(
      NotFoundError,
    );
    await expect(reactivateUser(actorOf(owner), unknown)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("refuses an admin actor", async () => {
    const admin = await createUserRow();
    const target = await createUserRow();

    await expect(deactivateUser(actorOf(admin), target.id)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(reactivateUser(actorOf(admin), target.id)).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("changeOwnPassword (FR-056, FR-021)", () => {
  const CURRENT = "the current password";
  const NEXT = "a brand new password";

  async function signedIn() {
    return createUserRow({ passwordHash: await hashPassword(CURRENT) });
  }

  it("replaces the password, resets failures, and ends earlier sessions", async () => {
    const user = await signedIn();
    await db.user.update({
      where: { id: user.id },
      data: { failedSignInCount: 2 },
    });
    const earlier = { authTime: Date.now() - 1_000 };

    await changeOwnPassword(actorOf(user), {
      currentPassword: CURRENT,
      newPassword: NEXT,
    });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(NEXT, stored.passwordHash!)).toBe(true);
    expect(stored.failedSignInCount).toBe(0);
    expect(evaluateSession(earlier, stored, new Date(), policy)).toBeNull();
  });

  it("refuses a wrong current password on that field, and counts it toward the lock", async () => {
    const user = await signedIn();

    await expect(
      changeOwnPassword(actorOf(user), {
        currentPassword: "not it at all",
        newPassword: NEXT,
      }),
    ).rejects.toMatchObject({
      code: "validation_failed",
      fields: { currentPassword: ["account.currentPasswordWrong"] },
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .failedSignInCount,
    ).toBe(1);
  });

  it("locks the account on the fifth wrong current password", async () => {
    const user = await signedIn();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await changeOwnPassword(actorOf(user), {
        currentPassword: "not it at all",
        newPassword: NEXT,
      }).catch(() => undefined);
    }

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses any change while locked, even with the right password", async () => {
    const user = await signedIn();
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + 60_000) },
    });

    await expect(
      changeOwnPassword(actorOf(user), {
        currentPassword: CURRENT,
        newPassword: NEXT,
      }),
    ).rejects.toMatchObject({ code: "account_locked" });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(CURRENT, stored.passwordHash!)).toBe(true);
  });
});
