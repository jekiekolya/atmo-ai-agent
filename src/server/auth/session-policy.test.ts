import { describe, expect, it } from "vitest";

import { evaluateSession } from "@/server/auth/session-policy";

const HOUR = 3_600_000;
const signedInAt = Date.UTC(2026, 8, 26, 9, 0, 0);
const policy = { absoluteLifetimeMs: 24 * HOUR };
const claims = { authTime: signedInAt };

const user = {
  isActive: true,
  role: "ADMIN" as const,
  firstName: "Olena",
  lastName: "Kovalenko",
  email: "olena@example.com",
  passwordChangedAt: null as Date | null,
  signedOutAt: null as Date | null,
};

const at = (offsetMs: number) => new Date(signedInAt + offsetMs);

describe("evaluateSession", () => {
  it("accepts a fresh session and returns the stored identity", () => {
    expect(evaluateSession(claims, user, at(HOUR), policy)).toEqual({
      role: "ADMIN",
      firstName: "Olena",
      lastName: "Kovalenko",
      email: "olena@example.com",
    });
  });

  it("takes the role from the user, not the claims (FR-024)", () => {
    const promoted = { ...user, role: "SUPER_ADMIN" as const };
    expect(evaluateSession(claims, promoted, at(HOUR), policy)?.role).toBe(
      "SUPER_ADMIN",
    );
  });

  it("rejects a missing user", () => {
    expect(evaluateSession(claims, null, at(HOUR), policy)).toBeNull();
  });

  it("rejects a deactivated user (FR-023)", () => {
    expect(
      evaluateSession(claims, { ...user, isActive: false }, at(HOUR), policy),
    ).toBeNull();
  });

  it("rejects a session issued before a password change (FR-025)", () => {
    const changed = { ...user, passwordChangedAt: at(1) };
    expect(evaluateSession(claims, changed, at(HOUR), policy)).toBeNull();
  });

  it("accepts a session issued in the same instant as a password change", () => {
    const changed = { ...user, passwordChangedAt: at(0) };
    expect(evaluateSession(claims, changed, at(HOUR), policy)).not.toBeNull();
  });

  it("rejects a session issued before a sign-out (FR-066)", () => {
    const signedOut = { ...user, signedOutAt: at(1) };
    expect(evaluateSession(claims, signedOut, at(HOUR), policy)).toBeNull();
  });

  it("accepts a session issued in the same instant as a sign-out", () => {
    const signedOut = { ...user, signedOutAt: at(0) };
    expect(evaluateSession(claims, signedOut, at(HOUR), policy)).not.toBeNull();
  });

  it("accepts a session exactly at the absolute lifetime (FR-073)", () => {
    expect(evaluateSession(claims, user, at(24 * HOUR), policy)).not.toBeNull();
  });

  it("rejects a session one millisecond past the absolute lifetime", () => {
    expect(evaluateSession(claims, user, at(24 * HOUR + 1), policy)).toBeNull();
  });
});
