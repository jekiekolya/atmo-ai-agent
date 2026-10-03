import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hardNavigate = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: "/uk/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/lib/http/hard-navigate", () => ({ hardNavigate }));

import { SessionKeepAlive } from "./session-keep-alive";

const fetchMock = vi.fn();
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const signedIn = () => answer(200, { user: { id: "u-1" }, expires: "" });
const SIGN_IN = "/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1";

function returnToTab() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => signedIn());
  vi.stubGlobal("fetch", fetchMock);
  hardNavigate.mockReset();
  pathname.value = "/uk/dashboard";
  window.history.replaceState({}, "", "/uk/dashboard/users?x=1");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SessionKeepAlive", () => {
  it("asks the session endpoint on every page load, as server rendering cannot renew the cookie (FR-026)", async () => {
    render(<SessionKeepAlive />);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      cache: "no-store",
    });
  });

  it("asks again on every client navigation and on every return to the tab (FR-026)", async () => {
    const { rerender } = render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    pathname.value = "/uk/dashboard/account";
    rerender(<SessionKeepAlive />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    returnToTab();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("sends a refused session to sign-in with a full load, keeping the address (FR-071)", async () => {
    fetchMock.mockImplementation(async () => answer(200, null));
    render(<SessionKeepAlive />);

    await vi.waitFor(() => expect(hardNavigate).toHaveBeenCalledWith(SIGN_IN));
  });

  it("sends a session refused on the way back to the tab to sign-in (FR-071)", async () => {
    render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockImplementation(async () => answer(200, null));
    returnToTab();

    await vi.waitFor(() => expect(hardNavigate).toHaveBeenCalledWith(SIGN_IN));
  });

  it.each([
    ["no connection", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["a server error", async () => answer(500, {})],
    [
      "an unreadable answer",
      async () => new Response("<html>", { status: 200 }),
    ],
  ])(
    "stays on the page when the check meets %s: it cannot tell the session was refused",
    async (_, failure) => {
      fetchMock.mockImplementation(failure);
      render(<SessionKeepAlive />);
      returnToTab();

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(hardNavigate).not.toHaveBeenCalled();
    },
  );

  it("never schedules a timer, so an idle tab stays idle", () => {
    const setInterval = vi.spyOn(window, "setInterval");
    const setTimeout = vi.spyOn(window, "setTimeout");

    render(<SessionKeepAlive />);

    expect(setInterval).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
    setInterval.mockRestore();
    setTimeout.mockRestore();
  });
});
