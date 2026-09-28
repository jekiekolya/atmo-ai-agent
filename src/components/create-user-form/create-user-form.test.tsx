import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", () => ({ apiRequest }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => "the date" }),
}));

import { CreateUserForm } from "./create-user-form";

async function openAndFill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "users.create.open" }));
  await user.type(
    await screen.findByLabelText("users.create.email"),
    "new@example.com",
  );
  await user.type(screen.getByLabelText("users.create.firstName"), "Lesya");
  await user.type(screen.getByLabelText("users.create.lastName"), "Ukrainka");
  await user.click(screen.getByRole("button", { name: "users.create.submit" }));
}

beforeEach(() => {
  apiRequest.mockReset();
  refresh.mockReset();
  toastAdd.mockReset();
});

describe("CreateUserForm", () => {
  it("submits natively as POST, so fields never reach the address bar before hydration", async () => {
    const user = userEvent.setup();
    render(<CreateUserForm />);
    await user.click(screen.getByRole("button", { name: "users.create.open" }));

    expect(
      (await screen.findByRole("dialog")).querySelector("form"),
    ).toHaveAttribute("method", "post");
  });

  it("offers admin, preselected, as the only role (FR-048)", async () => {
    const user = userEvent.setup();
    render(<CreateUserForm />);
    await user.click(screen.getByRole("button", { name: "users.create.open" }));

    const role = await screen.findByRole("combobox");
    expect(role).toHaveTextContent("users.roles.ADMIN");
    await user.click(role);
    expect(await screen.findAllByRole("option")).toHaveLength(1);
  });

  it("creates the user, then shows the link once and refreshes the list", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: {
        user: { firstName: "Lesya", lastName: "Ukrainka" },
        invite: { path: "/invite/abc", expiresAt: "2026-09-29T12:00:00.000Z" },
      },
    });
    const user = userEvent.setup();
    render(<CreateUserForm />);

    await openAndFill(user);

    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/users", {
      email: "new@example.com",
      firstName: "Lesya",
      lastName: "Ukrainka",
      role: "ADMIN",
    });
    expect(await screen.findByLabelText("users.invite.linkLabel")).toHaveValue(
      `${window.location.origin}/invite/abc`,
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("points to reactivation when the address belongs to a deactivated account (FR-049)", async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      code: "email_in_use",
      detail: "deactivated",
    });
    const user = userEvent.setup();
    render(<CreateUserForm />);

    await openAndFill(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "errors.details.email_in_use_deactivated",
    );
  });

  it("shows server field errors under their field", async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      fields: { role: ["validation.role.notAssignable"] },
    });
    const user = userEvent.setup();
    render(<CreateUserForm />);

    await openAndFill(user);

    expect(
      await screen.findByText("validation.role.notAssignable"),
    ).toBeInTheDocument();
  });

  it("keeps what was typed after an unexpected failure (FR-070)", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "network" });
    const user = userEvent.setup();
    render(<CreateUserForm />);

    await openAndFill(user);

    await waitFor(() => expect(toastAdd).toHaveBeenCalled());
    expect(screen.getByLabelText("users.create.email")).toHaveValue(
      "new@example.com",
    );
  });

  it("cannot be submitted twice while pending (FR-059)", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<CreateUserForm />);

    await openAndFill(user);
    const pending = await screen.findByRole("button", {
      name: "users.create.pending",
    });
    await user.click(pending);

    expect(pending).toBeDisabled();
    expect(pending.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
