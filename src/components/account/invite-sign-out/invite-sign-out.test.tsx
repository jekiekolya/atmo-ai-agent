import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/client/api-client", () => ({ apiRequest }));
vi.mock("@/lib/http/client/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { InviteSignOut } from "./invite-sign-out";

beforeEach(() => {
  apiRequest.mockReset();
  hardNavigate.mockReset();
  toastAdd.mockReset();
});

describe("InviteSignOut", () => {
  it("signs out on the server, then does a full load of the same invite page", async () => {
    window.history.replaceState(null, "", "/uk/invite/a-token");
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<InviteSignOut />);

    await user.click(screen.getByRole("button", { name: "shell.signOut" }));

    await waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith("/uk/invite/a-token"),
    );
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/session/sign-out");
  });

  it("stays put and says so when the server fails", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "unexpected" });
    const user = userEvent.setup();
    render(<InviteSignOut />);

    await user.click(screen.getByRole("button", { name: "shell.signOut" }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "errors.unexpected",
        type: "error",
      }),
    );
    expect(hardNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "shell.signOut" })).toBeEnabled();
  });

  it("cannot be clicked twice while pending", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<InviteSignOut />);

    await user.click(screen.getByRole("button", { name: "shell.signOut" }));
    const pending = await screen.findByRole("button", {
      name: "shell.signingOut",
    });
    await user.click(pending);

    expect(pending).toBeDisabled();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
