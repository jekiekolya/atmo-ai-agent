import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const toastAdd = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.expiresAt ? `${key} ${values.expiresAt}` : key,
}));
vi.mock("@/i18n/use-format-instant", () => ({
  useFormatInstant: () => (value: Date, format: string) =>
    `${value.toISOString()}|${format}`,
}));

import { InviteLinkDialog } from "./invite-link-dialog";

const invite = {
  path: "/invite/abc",
  expiresAt: "2026-09-29T12:00:00.000Z",
  name: "Lesya Ukrainka",
};

describe("InviteLinkDialog (FR-042)", () => {
  it("shows the full link without a language segment, and says it is shown once", async () => {
    render(<InviteLinkDialog invite={invite} onClose={() => {}} />);

    expect(await screen.findByLabelText("users.invite.linkLabel")).toHaveValue(
      `${window.location.origin}/invite/abc`,
    );
    expect(screen.getByText("users.invite.shownOnce")).toBeInTheDocument();
  });

  it("states the expiry through the shared mechanism, as a date and time (FR-011)", async () => {
    render(<InviteLinkDialog invite={invite} onClose={() => {}} />);

    expect(
      await screen.findByText(
        "users.invite.description 2026-09-29T12:00:00.000Z|dateTime",
      ),
    ).toBeInTheDocument();
  });

  it("copies the link and confirms with a notification", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    render(<InviteLinkDialog invite={invite} onClose={() => {}} />);

    await user.click(
      await screen.findByRole("button", { name: "users.invite.copy" }),
    );

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/invite/abc`,
    );
    expect(toastAdd).toHaveBeenCalledWith({
      title: "users.invite.copied",
      type: "success",
    });
  });

  it("says so when the browser refuses to copy", async () => {
    const user = userEvent.setup();
    toastAdd.mockClear();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    render(<InviteLinkDialog invite={invite} onClose={() => {}} />);

    await user.click(
      await screen.findByRole("button", { name: "users.invite.copy" }),
    );

    expect(toastAdd).toHaveBeenCalledWith({
      title: "users.invite.copyFailed",
      type: "error",
    });
    expect(toastAdd).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "users.invite.copied" }),
    );
  });

  it("renders nothing when there is no link to show", () => {
    render(<InviteLinkDialog invite={null} onClose={() => {}} />);
    expect(
      screen.queryByLabelText("users.invite.linkLabel"),
    ).not.toBeInTheDocument();
  });

  it("asks the parent to drop the link on close", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InviteLinkDialog invite={invite} onClose={onClose} />);

    await user.click(
      await screen.findByRole("button", { name: "users.invite.done" }),
    );

    expect(onClose).toHaveBeenCalled();
  });
});
