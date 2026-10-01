import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const redirect = vi.fn((target: unknown) => {
  void target;
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/auth/auth", () => ({ auth: () => auth() }));
vi.mock("@/i18n/navigation", () => ({
  redirect: (arg: unknown) => redirect(arg),
}));
vi.mock("next/root-params", () => ({ locale: async () => "uk" }));
// Outside a React Server Components render, cache() is a pass-through here.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { getSessionUser, requireSuperAdmin, verifySession } =
  await import("@/auth/dal");

const sessionUser = {
  id: "u-1",
  email: "olena@example.com",
  role: "ADMIN" as const,
  firstName: "Olena",
  lastName: "Kovalenko",
};

beforeEach(() => {
  auth.mockReset();
  redirect.mockClear();
});

describe("getSessionUser", () => {
  it("returns the session's user", async () => {
    auth.mockResolvedValue({ user: sessionUser, expires: "" });
    expect(await getSessionUser()).toEqual(sessionUser);
  });

  it("returns null without a session", async () => {
    auth.mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });
});

describe("verifySession", () => {
  it("returns the user when there is one", async () => {
    auth.mockResolvedValue({ user: sessionUser, expires: "" });
    expect(await verifySession()).toEqual(sessionUser);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to the sign-in page in the request's locale otherwise", async () => {
    auth.mockResolvedValue(null);

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith({ href: "/sign-in", locale: "uk" });
  });
});

describe("requireSuperAdmin", () => {
  it("marks an admin as not permitted without redirecting", async () => {
    auth.mockResolvedValue({ user: sessionUser, expires: "" });

    expect(await requireSuperAdmin()).toEqual({
      user: sessionUser,
      permitted: false,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("permits the super admin", async () => {
    const owner = { ...sessionUser, role: "SUPER_ADMIN" as const };
    auth.mockResolvedValue({ user: owner, expires: "" });

    expect(await requireSuperAdmin()).toEqual({ user: owner, permitted: true });
  });
});
