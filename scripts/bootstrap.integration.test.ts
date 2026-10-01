import { describe, expect, it } from "vitest";

import { parseBootstrapEnv } from "./bootstrap-env";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { bootstrapSuperAdmin } from "@/server/users/user-service";

const input = {
  email: "owner@example.com",
  firstName: "Olena",
  lastName: "Kovalenko",
  password: "correct horse battery",
};

const superAdmins = () => db.user.findMany({ where: { role: "SUPER_ADMIN" } });

describe("bootstrapSuperAdmin (contracts/bootstrap.md)", () => {
  it("creates an active super admin whose password verifies", async () => {
    expect(await bootstrapSuperAdmin(input)).toEqual({
      outcome: "created",
      email: "owner@example.com",
    });

    const [owner] = await superAdmins();
    expect(owner).toMatchObject({
      email: "owner@example.com",
      isActive: true,
      firstName: "Olena",
    });
    expect(owner.passwordChangedAt).toBeInstanceOf(Date);
    expect(await verifyPassword(input.password, owner.passwordHash!)).toBe(
      true,
    );
  });

  it("changes nothing on a second run with the same settings", async () => {
    await bootstrapSuperAdmin(input);
    const [before] = await superAdmins();

    expect(await bootstrapSuperAdmin(input)).toEqual({
      outcome: "exists",
      email: "owner@example.com",
    });
    const [after] = await superAdmins();
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it("never rewrites the existing super admin when the settings change (FR-009)", async () => {
    await bootstrapSuperAdmin(input);
    const [before] = await superAdmins();

    const result = await bootstrapSuperAdmin({
      ...input,
      email: "someone-else@example.com",
      password: "a different password",
    });

    expect(result).toEqual({ outcome: "exists", email: "owner@example.com" });
    expect(await superAdmins()).toEqual([before]);
  });

  it("leaves the same state after ten runs as after one (SC-002)", async () => {
    for (let run = 0; run < 10; run += 1) await bootstrapSuperAdmin(input);

    expect(await db.user.count()).toBe(1);
  });

  it("yields exactly one super admin under concurrent runs (SC-003)", async () => {
    const results = await Promise.all([
      bootstrapSuperAdmin(input),
      bootstrapSuperAdmin({ ...input, email: "other@example.com" }),
    ]);

    expect(await superAdmins()).toHaveLength(1);
    expect(results.map((result) => result.outcome).sort()).toEqual([
      "created",
      "exists",
    ]);
  });

  it("refuses, changing nothing, when an admin already holds the email", async () => {
    await db.user.create({
      data: {
        email: "owner@example.com",
        firstName: "A",
        lastName: "B",
        role: "ADMIN",
      },
    });

    expect(await bootstrapSuperAdmin(input)).toEqual({
      outcome: "email_taken",
      email: "owner@example.com",
    });
    expect(await superAdmins()).toHaveLength(0);
  });
});

describe("parseBootstrapEnv", () => {
  const env = {
    BOOTSTRAP_SUPER_ADMIN_EMAIL: " Owner@Example.com ",
    BOOTSTRAP_SUPER_ADMIN_FIRST_NAME: "Olena",
    BOOTSTRAP_SUPER_ADMIN_LAST_NAME: "Kovalenko",
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: "correct horse battery",
  };

  it("parses and normalizes valid settings", () => {
    expect(parseBootstrapEnv(env)).toEqual({
      success: true,
      data: { ...input },
    });
  });

  it("names every missing variable", () => {
    const result = parseBootstrapEnv({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain("  BOOTSTRAP_SUPER_ADMIN_EMAIL: not set");
      expect(result.errors).toContain(
        "  BOOTSTRAP_SUPER_ADMIN_PASSWORD: not set",
      );
    }
  });

  it("explains each invalid value in English, not as a catalog key", () => {
    const result = parseBootstrapEnv({
      ...env,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: "nope",
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        "  BOOTSTRAP_SUPER_ADMIN_EMAIL: Enter a valid email address.",
        "  BOOTSTRAP_SUPER_ADMIN_PASSWORD: Use at least 12 characters.",
      ]);
    }
  });

  it.each([
    ["too short", "a".repeat(11)],
    ["longer than 72 bytes", "a".repeat(73)],
  ])("refuses a password that is %s", (_, password) => {
    const result = parseBootstrapEnv({
      ...env,
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: password,
    });
    expect(result.success).toBe(false);
  });
});
