import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: "/uk/dashboard" }));

vi.mock("next-auth/react", () => ({ getSession, useSession }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/lib/http/hard-navigate", () => ({ hardNavigate }));

import { SessionKeepAlive } from "./session-keep-alive";

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({ user: {}, expires: "" });
  useSession.mockReset();
  hardNavigate.mockReset();
  pathname.value = "/uk/dashboard";
  window.history.replaceState({}, "", "/uk/dashboard");
});

describe("SessionKeepAlive", () => {
  it("asks the session endpoint on every page load, as server rendering cannot renew the cookie (FR-026)", async () => {
    render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    expect(getSession).toHaveBeenCalledWith({ broadcast: false });
  });

  it("asks again on every client navigation, renewing the window (FR-026)", async () => {
    const { rerender } = render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));

    pathname.value = "/uk/dashboard/account";
    rerender(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));

    pathname.value = "/uk/dashboard";
    rerender(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(3));
  });

  it("sends the visitor to sign-in as soon as the provider finds the session refused (FR-071)", () => {
    window.history.replaceState({}, "", "/uk/dashboard/users?x=1");
    render(<SessionKeepAlive />);

    const options = useSession.mock.calls[0][0] as {
      required: boolean;
      onUnauthenticated: () => void;
    };
    expect(options.required).toBe(true);
    options.onUnauthenticated();

    expect(hardNavigate).toHaveBeenCalledWith(
      "/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1",
    );
  });

  it("sends a rejected session to sign-in with a full load, keeping the address (FR-071)", async () => {
    getSession.mockResolvedValue(null);
    const { rerender } = render(<SessionKeepAlive />);

    window.history.replaceState({}, "", "/uk/dashboard/users?x=1");
    pathname.value = "/uk/dashboard/users";
    rerender(<SessionKeepAlive />);

    await vi.waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith(
        "/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1",
      ),
    );
  });

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
