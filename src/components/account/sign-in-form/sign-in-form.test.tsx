import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/lib/http/client/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { SignInForm } from "./sign-in-form";

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("auth.signIn.email"),
    "olena@example.com",
  );
  await user.type(
    screen.getByLabelText("auth.signIn.password"),
    "correct horse",
  );
}

beforeEach(() => {
  signIn.mockReset();
  hardNavigate.mockReset();
  toastAdd.mockReset();
});

describe("SignInForm", () => {
  it("submits natively as POST, so fields never reach the address bar before hydration", () => {
    const { container } = render(<SignInForm callbackUrl="/uk/dashboard" />);
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("navigates to the callback address with a full load on success", async () => {
    signIn.mockResolvedValue({
      ok: true,
      error: undefined,
      status: 200,
      url: "/",
      code: undefined,
    });
    const user = userEvent.setup();
    render(<SignInForm callbackUrl="/uk/dashboard/users" />);

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "auth.signIn.submit" }),
    );

    await waitFor(() =>
      expect(hardNavigate).toHaveBeenCalledWith("/uk/dashboard/users"),
    );
    expect(signIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "olena@example.com",
      password: "correct horse",
    });
  });

  it.each(["credentials", "locked", undefined])(
    "shows the one uniform message whatever the code (%s), even with ok: true",
    async (code) => {
      signIn.mockResolvedValue({
        ok: true,
        error: "CredentialsSignin",
        status: 200,
        url: null,
        code,
      });
      const user = userEvent.setup();
      render(<SignInForm callbackUrl="/uk/dashboard" />);

      await fill(user);
      await user.click(
        screen.getByRole("button", { name: "auth.signIn.submit" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "auth.signIn.failed",
      );
      expect(hardNavigate).not.toHaveBeenCalled();
      expect(screen.getByLabelText("auth.signIn.password")).toHaveValue("");
      expect(screen.getByLabelText("auth.signIn.email")).toHaveValue(
        "olena@example.com",
      );
    },
  );

  it.each([
    [
      "a server-side failure",
      () =>
        signIn.mockResolvedValue({
          ok: true,
          error: "Configuration",
          status: 200,
          url: null,
          code: undefined,
        }),
    ],
    ["no response", () => signIn.mockResolvedValue(undefined)],
    [
      "no connection",
      () => signIn.mockRejectedValue(new TypeError("Failed to fetch")),
    ],
  ])(
    "reports %s as unexpected, not as wrong credentials (FR-070)",
    async (_, arrange) => {
      arrange();
      const user = userEvent.setup();
      render(<SignInForm callbackUrl="/uk/dashboard" />);

      await fill(user);
      await user.click(
        screen.getByRole("button", { name: "auth.signIn.submit" }),
      );

      await waitFor(() =>
        expect(toastAdd).toHaveBeenCalledWith({
          title: "errors.unexpected",
          type: "error",
        }),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "auth.signIn.submit" }),
      ).toBeEnabled();
      expect(screen.getByLabelText("auth.signIn.password")).toHaveValue("");
      expect(screen.getByLabelText("auth.signIn.email")).toHaveValue(
        "olena@example.com",
      );
    },
  );

  it("cannot be submitted twice while pending", async () => {
    signIn.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<SignInForm callbackUrl="/uk/dashboard" />);

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "auth.signIn.submit" }),
    );

    const pending = await screen.findByRole("button", {
      name: "auth.signIn.pending",
    });
    expect(pending).toBeDisabled();
    expect(pending.querySelector('[data-slot="spinner"]')).not.toBeNull();
    await user.click(pending);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("validates before sending anything", async () => {
    const user = userEvent.setup();
    render(<SignInForm callbackUrl="/uk/dashboard" />);

    await user.type(screen.getByLabelText("auth.signIn.email"), "not-an-email");
    await user.click(
      screen.getByRole("button", { name: "auth.signIn.submit" }),
    );

    expect(
      await screen.findByText("validation.email.invalid"),
    ).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("can be completed with the keyboard alone", async () => {
    signIn.mockResolvedValue({
      ok: true,
      error: undefined,
      status: 200,
      url: "/",
      code: undefined,
    });
    const user = userEvent.setup();
    render(<SignInForm callbackUrl="/uk/dashboard" />);

    await user.tab();
    await user.keyboard("olena@example.com");
    await user.tab();
    await user.keyboard("correct horse{Enter}");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalled());
  });
});
