import { describe, expect, it } from "vitest";

import { verifyPassword } from "@/server/auth/password";
import { evaluateSession } from "@/server/auth/session-policy";
import { db } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  GoneError,
  InvalidInviteError,
  NotFoundError,
} from "@/server/errors";
import {
  acceptInvite,
  inspectInvite,
  issueInvite,
  issueInviteFor,
  revokeInvite,
} from "@/server/invites/invite-service";
import { hashInviteToken } from "@/server/invites/invite-token";
import {
  actorOf,
  createSuperAdminRow,
  createUserRow,
} from "@/server/testing/fixtures";

const PASSWORD = "a brand new password";
const UNKNOWN_ID = "00000000-0000-7000-8000-000000000000";

async function invited() {
  const owner = await createSuperAdminRow();
  const user = await createUserRow({ passwordHash: null });
  const { token } = await db.$transaction((tx) =>
    issueInviteFor(user.id, owner.id, tx),
  );
  return { owner, user, token };
}

describe("inspectInvite (FR-045)", () => {
  it("is valid for a fresh invite and names the account", async () => {
    const { user, token } = await invited();

    expect(await inspectInvite(token)).toEqual({
      status: "valid",
      email: user.email,
    });
  });

  it.each(["", "not-a-token", "x".repeat(43)])(
    "is invalid for %j",
    async (token) => {
      await invited();
      expect(await inspectInvite(token)).toEqual({ status: "invalid" });
    },
  );

  it("is invalid once revoked, even if it had also expired", async () => {
    const { token } = await invited();
    await db.invite.updateMany({
      data: { revokedAt: new Date(), expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await inspectInvite(token)).toEqual({ status: "invalid" });
  });

  it("is invalid when superseded by a newer invite", async () => {
    const { owner, user, token } = await invited();
    await db.$transaction((tx) => issueInviteFor(user.id, owner.id, tx));

    expect(await inspectInvite(token)).toEqual({ status: "invalid" });
  });

  it("is invalid when the account is deactivated", async () => {
    const { user, token } = await invited();
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await inspectInvite(token)).toEqual({ status: "invalid" });
  });

  it("is used once consumed", async () => {
    const { token } = await invited();
    await acceptInvite({ token, password: PASSWORD });

    expect(await inspectInvite(token)).toEqual({ status: "used" });
  });

  it("is expired past its expiry", async () => {
    const { token } = await invited();
    await db.invite.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await inspectInvite(token)).toEqual({ status: "expired" });
  });
});

describe("issueInviteFor", () => {
  it("expires 72 hours after issue, records the issuer, and stores only a fingerprint", async () => {
    const { owner, user, token } = await invited();
    const [invite] = await db.invite.findMany({ where: { userId: user.id } });

    expect(invite.issuedById).toBe(owner.id);
    expect(invite.tokenHash).toBe(hashInviteToken(token));
    expect(invite.tokenHash).not.toContain(token);
    const hours =
      (invite.expiresAt.getTime() - invite.createdAt.getTime()) / 3_600_000;
    expect(hours).toBeCloseTo(72, 1);
  });
});

describe("acceptInvite (FR-044)", () => {
  it("sets the password, activates the account, clears any lock, and consumes the invite", async () => {
    const { user, token } = await invited();
    await db.user.update({
      where: { id: user.id },
      data: {
        failedSignInCount: 3,
        lockedUntil: new Date(Date.now() + 60_000),
      },
    });

    await acceptInvite({ token, password: PASSWORD });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(PASSWORD, stored.passwordHash!)).toBe(true);
    expect(stored.passwordChangedAt).toBeInstanceOf(Date);
    expect(stored.failedSignInCount).toBe(0);
    expect(stored.lockedUntil).toBeNull();
    expect((await db.invite.findFirstOrThrow()).consumedAt).toBeInstanceOf(
      Date,
    );
  });

  it("refuses each unusable outcome with its own error", async () => {
    const { token } = await invited();
    await expect(
      acceptInvite({ token: "x".repeat(43), password: PASSWORD }),
    ).rejects.toThrow(InvalidInviteError);

    await db.invite.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(acceptInvite({ token, password: PASSWORD })).rejects.toThrow(
      GoneError,
    );
  });

  it("lets exactly one of two simultaneous submissions win", async () => {
    const { user, token } = await invited();

    const results = await Promise.allSettled([
      acceptInvite({ token, password: PASSWORD }),
      acceptInvite({ token, password: "the losing password" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ConflictError);
    expect(reason.code).toBe("invite_used");

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const winnerIsFirst = results[0].status === "fulfilled";
    expect(
      await verifyPassword(
        winnerIsFirst ? PASSWORD : "the losing password",
        stored.passwordHash!,
      ),
    ).toBe(true);
  });
});

describe("issueInvite (FR-050, FR-051)", () => {
  it("supersedes the previous link and leaves an active user's password alone", async () => {
    const owner = await createSuperAdminRow();
    const user = await createUserRow({ passwordHash: "existing-hash" });
    const first = await issueInvite(actorOf(owner), user.id);

    const second = await issueInvite(actorOf(owner), user.id);

    expect(await inspectInvite(first.token)).toEqual({ status: "invalid" });
    expect(await inspectInvite(second.token)).toMatchObject({
      status: "valid",
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toBe("existing-hash");
  });

  it("recovers a forgotten password: accepting replaces it and ends older sessions", async () => {
    const owner = await createSuperAdminRow();
    const user = await createUserRow({ passwordHash: "existing-hash" });
    const earlier = { authTime: Date.now() - 1_000 };
    const { token } = await issueInvite(actorOf(owner), user.id);

    await acceptInvite({ token, password: PASSWORD });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(PASSWORD, stored.passwordHash!)).toBe(true);
    expect(
      evaluateSession(earlier, stored, new Date(), {
        absoluteLifetimeMs: 86_400_000,
      }),
    ).toBeNull();
  });

  it.each([
    ["the super admin", "super_admin"],
    ["a deactivated account", "deactivated"],
  ])("is refused for %s", async (_, detail) => {
    const owner = await createSuperAdminRow();
    const target =
      detail === "super_admin"
        ? owner
        : await createUserRow({ isActive: false });

    await expect(issueInvite(actorOf(owner), target.id)).rejects.toMatchObject({
      code: "invite_not_allowed",
      detail,
    });
  });

  it("refuses an admin actor", async () => {
    const admin = await createUserRow();
    const target = await createUserRow();

    await expect(issueInvite(actorOf(admin), target.id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("reports an unknown account", async () => {
    const owner = await createSuperAdminRow();

    await expect(issueInvite(actorOf(owner), UNKNOWN_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("is a conflict when a simultaneous request issues one first", async () => {
    const owner = await createSuperAdminRow();
    const user = await createUserRow();
    let inserted!: () => void;
    let release!: () => void;
    const insertedSignal = new Promise<void>((resolve) => (inserted = resolve));
    const releaseSignal = new Promise<void>((resolve) => (release = resolve));

    const winner = db.$transaction(async (tx) => {
      await issueInviteFor(user.id, owner.id, tx);
      inserted();
      await releaseSignal;
    });
    await insertedSignal;

    const loser = issueInvite(actorOf(owner), user.id);
    loser.catch(() => {});
    // The loser's insert now waits on the winner's uncommitted row.
    await expect
      .poll(async () => {
        const [{ waiting }] = await db.$queryRaw<[{ waiting: number }]>`
          SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted`;
        return waiting;
      })
      .toBeGreaterThan(0);
    release();
    await winner;

    await expect(loser).rejects.toMatchObject({
      constructor: ConflictError,
      code: "invite_issued_concurrently",
    });
    expect(await db.invite.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("revokeInvite (FR-052)", () => {
  it("revokes the outstanding link without touching password or status", async () => {
    const { owner, user, token } = await invited();

    await revokeInvite(actorOf(owner), user.id);

    expect(await inspectInvite(token)).toEqual({ status: "invalid" });
    expect(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({
      isActive: true,
      passwordHash: null,
    });
  });

  it("reports an unknown account", async () => {
    const owner = await createSuperAdminRow();

    await expect(revokeInvite(actorOf(owner), UNKNOWN_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("reports when there is nothing to revoke", async () => {
    const owner = await createSuperAdminRow();
    const user = await createUserRow();

    await expect(revokeInvite(actorOf(owner), user.id)).rejects.toMatchObject({
      code: "no_outstanding_invite",
    });
  });

  it("refuses an admin actor", async () => {
    const { user } = await invited();
    const admin = await createUserRow();

    await expect(revokeInvite(actorOf(admin), user.id)).rejects.toThrow(
      ForbiddenError,
    );
  });
});
