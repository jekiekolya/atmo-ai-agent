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
  useLocale: () => "uk",
  useTranslations: () => (key: string, values?: { name?: string }) =>
    values?.name ? `${key}:${values.name}` : key,
}));

import { AccountMenu } from "./account-menu";

beforeEach(() => {
  apiRequest.mockReset();
  hardNavigate.mockReset();
  toastAdd.mockReset();
});

async function openMenu() {
  const user = userEvent.setup();
  render(<AccountMenu name="Olena Koval" />);
  await user.click(
    screen.getByRole("button", { name: "shell.accountMenu:Olena Koval" }),
  );
  return user;
}

describe("AccountMenu", () => {
  it("shows the signed-in name on the trigger and in the menu", async () => {
    await openMenu();

    expect(
      screen.getByRole("button", { name: "shell.accountMenu:Olena Koval" }),
    ).toHaveTextContent("Olena Koval");
    expect(
      await screen.findByText("shell.signedInAs:Olena Koval"),
    ).toBeInTheDocument();
  });

  it("signs out on the server, then does a full load of the sign-in page", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const user = await openMenu();

    await user.click(
      await screen.findByRole("menuitem", { name: "shell.signOut" }),
    );

    await waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith("/uk/sign-in"),
    );
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/session/sign-out");
  });

  it("stays put and says so when the server fails, never pretending to sign out", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "unexpected" });
    const user = await openMenu();

    await user.click(
      await screen.findByRole("menuitem", { name: "shell.signOut" }),
    );

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "errors.unexpected",
        type: "error",
      }),
    );
    expect(hardNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menuitem", { name: "shell.signOut" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("cannot be clicked twice while pending, and keeps the menu open to show it (FR-059)", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = await openMenu();

    await user.click(
      await screen.findByRole("menuitem", { name: "shell.signOut" }),
    );
    const pending = await screen.findByRole("menuitem", {
      name: "shell.signingOut",
    });
    await user.click(pending);

    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
