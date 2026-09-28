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
  useLocale: () => "uk",
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

import { SetPasswordForm } from "./set-password-form";

const PASSWORD = "a brand new password";

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  confirm = PASSWORD,
) {
  await user.type(screen.getByLabelText("invite.password"), PASSWORD);
  await user.type(screen.getByLabelText("invite.confirmPassword"), confirm);
  await user.click(screen.getByRole("button", { name: "invite.submit" }));
}

beforeEach(() => {
  apiRequest.mockReset();
  hardNavigate.mockReset();
  toastAdd.mockReset();
});

describe("SetPasswordForm", () => {
  it("submits natively as POST, so fields never reach the address bar before hydration", () => {
    const { container } = render(<SetPasswordForm token="tok" />);
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("posts the token and password, then goes to sign-in with a notice (FR-046)", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<SetPasswordForm token="tok" />);

    await fill(user);

    await waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith(
        "/uk/sign-in?notice=password-set",
      ),
    );
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/invites/accept", {
      token: "tok",
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
  });

  it("catches a mismatch before sending anything", async () => {
    const user = userEvent.setup();
    render(<SetPasswordForm token="tok" />);

    await fill(user, "something else entirely");

    expect(
      await screen.findByText("validation.confirmPassword.mismatch"),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it.each(["invite_used", "invite_expired", "invite_invalid"])(
    "shows %s in the form when the link became unusable before submit",
    async (code) => {
      apiRequest.mockResolvedValue({ ok: false, code });
      const user = userEvent.setup();
      render(<SetPasswordForm token="tok" />);

      await fill(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        `errors.codes.${code}`,
      );
      expect(hardNavigate).not.toHaveBeenCalled();
    },
  );

  it("puts server field errors under their field", async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      fields: { password: ["validation.password.tooLong"] },
    });
    const user = userEvent.setup();
    render(<SetPasswordForm token="tok" />);

    await fill(user);

    expect(
      await screen.findByText("validation.password.tooLong"),
    ).toBeInTheDocument();
  });

  it("reports an unexpected failure as a notification and clears the passwords (FR-070)", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "network" });
    const user = userEvent.setup();
    render(<SetPasswordForm token="tok" />);

    await fill(user);

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "errors.unexpected",
        type: "error",
      }),
    );
    expect(screen.getByLabelText("invite.password")).toHaveValue("");
  });

  it("cannot be submitted twice while pending", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<SetPasswordForm token="tok" />);

    await fill(user);
    const pending = await screen.findByRole("button", {
      name: "invite.pending",
    });
    await user.click(pending);

    expect(pending).toBeDisabled();
    expect(pending.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
