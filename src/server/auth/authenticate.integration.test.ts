import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticate } from "@/server/auth/authenticate";
import {
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";
import { db } from "@/server/db";

vi.mock("@/server/auth/password", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/auth/password")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const PASSWORD = "correct horse battery";
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  vi.mocked(verifyPassword).mockClear();
});

function createUser(
  overrides: Partial<{
    email: string;
    isActive: boolean;
    passwordHash: string | null;
  }> = {},
) {
  return db.user.create({
    data: {
      email: "olena@example.com",
      firstName: "Olena",
      lastName: "Kovalenko",
      role: "ADMIN",
      passwordHash,
      passwordChangedAt: new Date(),
      ...overrides,
    },
  });
}

describe("authenticate", () => {
  it("returns the user for the correct password", async () => {
    const user = await createUser();

    expect((await authenticate("olena@example.com", PASSWORD))?.id).toBe(
      user.id,
    );
  });

  it("finds the account whatever the case and surrounding spaces", async () => {
    const user = await createUser();

    expect((await authenticate("  Olena@Example.com ", PASSWORD))?.id).toBe(
      user.id,
    );
  });

  it.each([
    ["an unknown email", {}, "nobody@example.com", PASSWORD],
    ["a wrong password", {}, "olena@example.com", "wrong password here"],
    [
      "an account with no password yet",
      { passwordHash: null },
      "olena@example.com",
      PASSWORD,
    ],
    [
      "a deactivated account",
      { isActive: false },
      "olena@example.com",
      PASSWORD,
    ],
    ["a malformed email", {}, "not-an-email", PASSWORD],
  ])(
    "returns null for %s, after exactly one comparison (FR-015)",
    async (_, overrides, email, password) => {
      await createUser(overrides);

      expect(await authenticate(email, password)).toBeNull();
      expect(verifyPassword).toHaveBeenCalledTimes(1);
    },
  );

  it("compares against the dummy hash when there is no stored hash", async () => {
    await createUser({ passwordHash: null });

    await authenticate("olena@example.com", PASSWORD);

    expect(verifyPassword).toHaveBeenCalledWith(PASSWORD, DUMMY_HASH);
  });
});

describe("lockout (FR-018 – FR-020)", () => {
  const WRONG = "wrong password here";
  const stored = (id: string) => db.user.findUniqueOrThrow({ where: { id } });

  async function fail(times: number) {
    for (let attempt = 0; attempt < times; attempt += 1) {
      await authenticate("olena@example.com", WRONG);
    }
  }

  it("counts failures one to four", async () => {
    const user = await createUser();
    await fail(4);

    expect(await stored(user.id)).toMatchObject({
      failedSignInCount: 4,
      lockedUntil: null,
    });
  });

  it("locks for fifteen minutes on the fifth failure and restarts the count", async () => {
    const user = await createUser();
    const before = Date.now();
    await fail(5);

    const after = await stored(user.id);
    expect(after.failedSignInCount).toBe(0);
    const lockMs = after.lockedUntil!.getTime() - before;
    expect(lockMs).toBeGreaterThanOrEqual(15 * 60_000 - 1_000);
    expect(lockMs).toBeLessThanOrEqual(15 * 60_000 + 5_000);
  });

  it("refuses the correct password while locked, after one comparison, without counting", async () => {
    const user = await createUser();
    await fail(5);
    const lockedUntil = (await stored(user.id)).lockedUntil;
    vi.mocked(verifyPassword).mockClear();

    expect(await authenticate("olena@example.com", PASSWORD)).toBeNull();
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(await stored(user.id)).toMatchObject({
      failedSignInCount: 0,
      lockedUntil,
    });
  });

  it("lets the right password in once the lock has passed, and resets", async () => {
    const user = await createUser();
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1_000), failedSignInCount: 0 },
    });

    expect((await authenticate("olena@example.com", PASSWORD))?.id).toBe(
      user.id,
    );
    expect(await stored(user.id)).toMatchObject({
      failedSignInCount: 0,
      lockedUntil: null,
    });
  });

  it("counts a failure after the lock has passed as the first of a new run", async () => {
    const user = await createUser();
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1_000), failedSignInCount: 0 },
    });

    await fail(1);

    expect((await stored(user.id)).failedSignInCount).toBe(1);
  });

  it("resets the count on a success below the threshold", async () => {
    const user = await createUser();
    await fail(3);

    await authenticate("olena@example.com", PASSWORD);

    expect((await stored(user.id)).failedSignInCount).toBe(0);
  });

  it("stays locked under five concurrent wrong attempts", async () => {
    const user = await createUser();

    await Promise.all(
      Array.from({ length: 5 }, () => authenticate("olena@example.com", WRONG)),
    );

    expect((await stored(user.id)).lockedUntil!.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("gives a burst of simultaneous guesses no more than five comparisons (FR-018)", async () => {
    const user = await createUser();
    vi.mocked(verifyPassword).mockClear();

    await Promise.all(
      Array.from({ length: 20 }, () =>
        authenticate("olena@example.com", WRONG),
      ),
    );

    const againstStoredHash = vi
      .mocked(verifyPassword)
      .mock.calls.filter(([, hash]) => hash !== DUMMY_HASH);
    expect(againstStoredHash).toHaveLength(5);
    const after = await stored(user.id);
    expect(after.failedSignInCount).toBe(0);
    expect(after.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("never counts an attempt that finishes after the lock, so the next run starts at one (FR-020)", async () => {
    const user = await createUser();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(verifyPassword).mockImplementationOnce(async () => {
      await held;
      return false;
    });

    // Read the account before the lock, then stall in the comparison.
    const late = authenticate("olena@example.com", WRONG);
    await vi.waitFor(() => expect(verifyPassword).toHaveBeenCalledTimes(1));
    await fail(5);
    release();
    await late;
    expect((await stored(user.id)).failedSignInCount).toBe(0);

    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1_000) },
    });
    await fail(1);

    expect((await stored(user.id)).failedSignInCount).toBe(1);
  });

  it("writes nothing for an unknown email", async () => {
    const user = await createUser();
    await Promise.all(
      Array.from({ length: 6 }, () =>
        authenticate("nobody@example.com", WRONG),
      ),
    );

    expect(await stored(user.id)).toMatchObject({
      failedSignInCount: 0,
      lockedUntil: null,
    });
  });
});
