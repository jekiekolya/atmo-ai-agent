import { describe, expect, it, vi } from "vitest";

import { jwtCallback } from "@/auth/jwt-callback";

const HOUR = 3_600_000;
const now = new Date(Date.UTC(2026, 8, 26, 12, 0, 0));

const stored = {
  id: "u-1",
  email: "olena@example.com",
  firstName: "Olena",
  lastName: "Kovalenko",
  role: "ADMIN" as const,
  isActive: true,
  passwordChangedAt: null,
  signedOutAt: null,
};

function deps(user: typeof stored | null = stored) {
  return {
    findUser: vi.fn(async () => user),
    now: () => now,
    policy: { absoluteLifetimeMs: 24 * HOUR },
  };
}

describe("jwtCallback", () => {
  it("stamps the user id and the sign-in time in milliseconds on sign-in", async () => {
    const token = await jwtCallback(
      { token: {}, user: stored, trigger: "signIn" },
      deps(),
    );

    expect(token).toMatchObject({
      sub: "u-1",
      authTime: now.getTime(),
      role: "ADMIN",
    });
  });

  it("reloads the user on every later call and copies the current role (FR-024)", async () => {
    const d = deps({ ...stored, role: "SUPER_ADMIN" as never });
    const token = await jwtCallback(
      { token: { sub: "u-1", authTime: now.getTime() - HOUR, role: "ADMIN" } },
      d,
    );

    expect(d.findUser).toHaveBeenCalledWith("u-1");
    expect(token?.role).toBe("SUPER_ADMIN");
  });

  it("returns null when the session is rejected", async () => {
    const token = await jwtCallback(
      { token: { sub: "u-1", authTime: now.getTime() - HOUR } },
      deps({ ...stored, isActive: false }),
    );

    expect(token).toBeNull();
  });

  it("returns null for a token without a subject or sign-in time", async () => {
    expect(
      await jwtCallback({ token: { authTime: now.getTime() } }, deps()),
    ).toBeNull();
    expect(await jwtCallback({ token: { sub: "u-1" } }, deps())).toBeNull();
  });
});
