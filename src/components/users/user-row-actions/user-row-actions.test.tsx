import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/client/api-client", () => ({ apiRequest }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { type RowUser, UserRowActions } from "./user-row-actions";

const admin: RowUser = {
  id: "u-2",
  name: "Taras Shevchenko",
  role: "ADMIN",
  status: "active",
  hasPendingInvite: false,
};

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "users.list.actionsFor" }),
  );
  return screen.findAllByRole("menuitem");
}

beforeEach(() => {
  apiRequest.mockReset();
  refresh.mockReset();
  toastAdd.mockReset();
});

describe("UserRowActions", () => {
  it("offers nothing on the super admin's row", () => {
    const { container } = render(
      <UserRowActions user={{ ...admin, role: "SUPER_ADMIN" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the menu trigger only through its label, with an icon and no literal text", () => {
    render(<UserRowActions user={admin} />);
    const trigger = screen.getByRole("button", {
      name: "users.list.actionsFor",
    });

    expect(trigger).toHaveTextContent(/^$/);
    expect(trigger.querySelector("svg[aria-hidden]")).not.toBeNull();
  });

  it("offers issue and deactivate for an active admin, and revoke only with a pending link", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserRowActions user={admin} />);
    expect((await openMenu(user)).map((item) => item.textContent)).toEqual([
      "users.actions.issueLink",
      "users.actions.deactivate",
    ]);
    unmount();

    render(
      <UserRowActions
        user={{ ...admin, status: "invited", hasPendingInvite: true }}
      />,
    );
    expect((await openMenu(user)).map((item) => item.textContent)).toEqual([
      "users.actions.issueLink",
      "users.actions.revokeLink",
      "users.actions.deactivate",
    ]);
  });

  it("offers only reactivate for a deactivated account", async () => {
    const user = userEvent.setup();
    render(<UserRowActions user={{ ...admin, status: "deactivated" }} />);

    expect((await openMenu(user)).map((item) => item.textContent)).toEqual([
      "users.actions.reactivate",
    ]);
  });

  it("asks for confirmation before deactivating, then confirms and refreshes", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: { user: {} } });
    const user = userEvent.setup();
    render(<UserRowActions user={admin} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.deactivate" }),
    );
    expect(apiRequest).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      screen
        .getAllByRole("button", { name: "users.actions.deactivate" })
        .at(-1)!,
    );

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/users/u-2/deactivate",
      ),
    );
    expect(toastAdd).toHaveBeenCalledWith({
      title: "users.notify.deactivated",
      type: "success",
    });
    expect(refresh).toHaveBeenCalled();
    expect(dialog).toBeDefined();
  });

  it("shows a newly issued link once", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: {
        invite: { path: "/invite/xyz", expiresAt: "2026-09-29T12:00:00.000Z" },
      },
    });
    const user = userEvent.setup();
    render(<UserRowActions user={admin} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.issueLink" }),
    );

    expect(
      await screen.findByDisplayValue(`${window.location.origin}/invite/xyz`),
    ).toBeInTheDocument();
  });

  it("reports a refusal as a notification with its specific message", async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      code: "invite_not_allowed",
      detail: "deactivated",
    });
    const user = userEvent.setup();
    render(<UserRowActions user={admin} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.issueLink" }),
    );

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "errors.details.invite_not_allowed_deactivated",
        type: "error",
      }),
    );
  });

  it("sends a confirmed action once, however often it is clicked (FR-059)", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<UserRowActions user={admin} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.deactivate" }),
    );
    await screen.findByRole("alertdialog");
    const confirm = screen
      .getAllByRole("button", { name: "users.actions.deactivate" })
      .at(-1)!;
    await user.dblClick(confirm);

    expect(confirm).toBeDisabled();
    expect(confirm.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("cannot be cancelled or dismissed while the confirmed request runs", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<UserRowActions user={admin} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.deactivate" }),
    );
    await screen.findByRole("alertdialog");
    await user.click(
      screen
        .getAllByRole("button", { name: "users.actions.deactivate" })
        .at(-1)!,
    );

    expect(
      screen.getByRole("button", { name: "users.actions.cancel" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("keeps the revoke wording while the dialog closes", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(
      <UserRowActions
        user={{ ...admin, status: "invited", hasPendingInvite: true }}
      />,
    );

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.revokeLink" }),
    );
    await screen.findByRole("alertdialog");

    const seen: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        seen.push(record.target.textContent ?? "");
        record.addedNodes.forEach((node) => seen.push(node.textContent ?? ""));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    await user.click(
      screen
        .getAllByRole("button", { name: "users.actions.revokeLink" })
        .at(-1)!,
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    observer.disconnect();

    expect(
      seen.some((text) => text.includes("users.actions.confirmDeactivate")),
    ).toBe(false);
  });

  it("keeps the actions closed until a menu action's request settles (FR-059)", async () => {
    let settle!: (result: unknown) => void;
    apiRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const user = userEvent.setup();
    render(<UserRowActions user={{ ...admin, status: "deactivated" }} />);

    await openMenu(user);
    await user.click(
      screen.getByRole("menuitem", { name: "users.actions.reactivate" }),
    );

    const trigger = screen.getByRole("button", {
      name: "users.list.actionsFor",
    });
    await waitFor(() => expect(trigger).toBeDisabled());
    expect(trigger.querySelector('[data-slot="spinner"]')).not.toBeNull();

    settle({ ok: true, data: { user: {} } });
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
