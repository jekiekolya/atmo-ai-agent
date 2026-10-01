import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
vi.mock("next-auth/jwt", () => ({
  getToken: (args: unknown) => getToken(args),
}));

const { proxyGuard } = await import("@/auth/proxy-guard");

const BASE = "http://localhost:3000";

function request(path: string) {
  return new NextRequest(new URL(path, BASE));
}

// What next-intl hands over for a prefixed page: a pass-through response.
const passThrough = () => NextResponse.next();

beforeEach(() => {
  getToken.mockReset();
  getToken.mockResolvedValue(null);
});

describe("proxyGuard (contracts/routing-and-session.md)", () => {
  it("sends an anonymous visitor from a protected address to the localized sign-in page", async () => {
    const response = await proxyGuard(
      request("/uk/dashboard/users?x=1"),
      passThrough(),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${BASE}/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1`,
    );
  });

  it("marks that redirect no-store and sets no cookie (FR-030)", async () => {
    const response = await proxyGuard(request("/en/dashboard"), passThrough());

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("lets a visitor with a valid cookie through untouched", async () => {
    getToken.mockResolvedValue({ sub: "u-1" });
    const intl = passThrough();

    expect(await proxyGuard(request("/uk/dashboard"), intl)).toBe(intl);
  });

  it("checks the cookie with the configured secret and cookie policy", async () => {
    await proxyGuard(request("/uk/dashboard"), passThrough());

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "test-secret-at-least-32-characters-long",
        secureCookie: false,
      }),
    );
  });

  it.each([
    "/uk/sign-in",
    "/uk",
    "/uk/demo/42",
    "/uk/whatever",
    "/uk/dashboards",
    "/uk/invite/abc",
  ])("never touches %s, whatever the cookie (R4)", async (path) => {
    const intl = passThrough();

    expect(await proxyGuard(request(path), intl)).toBe(intl);
    expect(getToken).not.toHaveBeenCalled();
  });
});
