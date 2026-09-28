import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", () => ({ apiRequest }));
vi.mock("@/lib/http/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

import { ChangePasswordForm } from "./change-password-form";

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  {
    current = "the current password",
    next = "a brand new password",
    confirm,
  }: { current?: string; next?: string; confirm?: string } = {},
) {
  confirm ??= next;
  await user.type(screen.getByLabelText("account.currentPassword"), current);
  await user.type(screen.getByLabelText("account.newPassword"), next);
  await user.type(screen.getByLabelText("account.confirmPassword"), confirm);
  await user.click(screen.getByRole("button", { name: "account.submit" }));
}

beforeEach(() => {
  apiRequest.mockReset();
  hardNavigate.mockReset();
  toastAdd.mockReset();
});

describe("ChangePasswordForm", () => {
  it("submits natively as POST, so fields never reach the address bar before hydration", () => {
    const { container } = render(<ChangePasswordForm />);
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("changes the password, then goes to sign-in with a notice (FR-057)", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);

    await waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith(
        "/en/sign-in?notice=password-changed",
      ),
    );
    expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/account/password", {
      currentPassword: "the current password",
      newPassword: "a brand new password",
      confirmPassword: "a brand new password",
    });
  });

  it("shows a wrong current password under that field and clears the passwords", async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      fields: { currentPassword: ["account.currentPasswordWrong"] },
    });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);

    expect(
      await screen.findByText("account.currentPasswordWrong"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("account.currentPassword")).toHaveValue("");
  });

  it("shows the lock in the form (FR-021)", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "account_locked" });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "account.locked",
    );
  });

  it("catches a mismatch and a reused password before sending", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user, {
      next: "a brand new password",
      confirm: "something else",
    });
    expect(
      await screen.findByText("validation.confirmPassword.mismatch"),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("refuses a new password equal to the current one", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user, {
      current: "the current password",
      next: "the current password",
    });

    expect(
      await screen.findByText("validation.newPassword.sameAsCurrent"),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure as a notification (FR-070)", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "unexpected" });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "errors.unexpected",
        type: "error",
      }),
    );
  });

  it("cannot be submitted twice while pending (FR-059)", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);
    const pending = await screen.findByRole("button", {
      name: "account.pending",
    });
    await user.click(pending);

    expect(pending).toBeDisabled();
    expect(pending.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
