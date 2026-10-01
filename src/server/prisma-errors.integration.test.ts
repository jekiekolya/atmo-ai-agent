import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";

const user = (email: string, role: "SUPER_ADMIN" | "ADMIN" = "ADMIN") => ({
  email,
  firstName: "Test",
  lastName: "User",
  role,
});

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the operation to fail");
}

describe("isUniqueViolation", () => {
  it("recognises the email constraint, and only it", async () => {
    await db.user.create({ data: user("a@example.com") });
    const error = await caught(db.user.create({ data: user("a@example.com") }));

    expect(isUniqueViolation(error, "users_email_key")).toBe(true);
    expect(isUniqueViolation(error, "users_one_super_admin")).toBe(false);
  });

  it("recognises the one-super-admin constraint", async () => {
    await db.user.create({ data: user("owner@example.com", "SUPER_ADMIN") });
    const error = await caught(
      db.user.create({ data: user("second@example.com", "SUPER_ADMIN") }),
    );

    expect(isUniqueViolation(error, "users_one_super_admin")).toBe(true);
    expect(isUniqueViolation(error, "users_email_key")).toBe(false);
  });

  it("recognises the one-outstanding-invite constraint", async () => {
    const owner = await db.user.create({
      data: user("owner@example.com", "SUPER_ADMIN"),
    });
    const invited = await db.user.create({ data: user("new@example.com") });
    const invite = (tokenHash: string) => ({
      userId: invited.id,
      issuedById: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await db.invite.create({ data: invite("hash-1") });
    const error = await caught(db.invite.create({ data: invite("hash-2") }));

    expect(isUniqueViolation(error, "invites_one_outstanding_per_user")).toBe(
      true,
    );
  });

  it("is false for anything that is not a Prisma unique violation", () => {
    expect(isUniqueViolation(new Error("boom"), "users_email_key")).toBe(false);
    expect(isUniqueViolation(undefined, "users_email_key")).toBe(false);
  });
});
