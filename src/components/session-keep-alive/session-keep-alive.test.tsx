import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: "/uk/dashboard" }));

vi.mock("next-auth/react", () => ({ getSession }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/lib/http/hard-navigate", () => ({ hardNavigate }));

import { SessionKeepAlive } from "./session-keep-alive";

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({ user: {}, expires: "" });
  hardNavigate.mockReset();
  pathname.value = "/uk/dashboard";
  window.history.replaceState({}, "", "/uk/dashboard");
});

describe("SessionKeepAlive", () => {
  it("does not ask on mount: the server just resolved this session", () => {
    render(<SessionKeepAlive />);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("asks the session endpoint on every client navigation, renewing the window (FR-026)", async () => {
    const { rerender } = render(<SessionKeepAlive />);

    pathname.value = "/uk/dashboard/account";
    rerender(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));

    pathname.value = "/uk/dashboard";
    rerender(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));
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
