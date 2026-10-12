import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/client/api-client", () => ({ apiRequest }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));
vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { DeleteConversationDialog } from "./delete-conversation-dialog";

const conversation = { id: "c-1", title: "Inverters" };

beforeEach(() => {
  apiRequest.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  toastAdd.mockReset();
});

async function openDialog(isOpenConversation = false) {
  const user = userEvent.setup();
  render(
    <DeleteConversationDialog
      conversation={conversation}
      isOpenConversation={isOpenConversation}
    />,
  );
  await user.click(screen.getByRole("button", { name: "chat.list.delete" }));
  return { user, dialog: await screen.findByRole("alertdialog") };
}

describe("DeleteConversationDialog", () => {
  it("asks first, saying deletion is permanent, and cancelling changes nothing", async () => {
    const { user, dialog } = await openDialog();

    expect(dialog).toHaveTextContent("chat.delete.title");
    expect(dialog).toHaveTextContent("chat.delete.description");
    await user.click(
      screen.getByRole("button", { name: "chat.delete.cancel" }),
    );

    expect(apiRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("deletes, confirms with a toast, and refreshes the list", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const { user } = await openDialog();

    await user.click(
      screen.getByRole("button", { name: "chat.delete.confirm" }),
    );

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("DELETE", "/api/chat/c-1"),
    );
    expect(toastAdd).toHaveBeenCalledWith({
      title: "chat.delete.done",
      type: "success",
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("takes the user to a new chat after deleting the open conversation", async () => {
    apiRequest.mockResolvedValue({ ok: true, data: undefined });
    const { user } = await openDialog(true);

    await user.click(
      screen.getByRole("button", { name: "chat.delete.confirm" }),
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/dashboard/chat"),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disables both buttons while the request is in flight", async () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    const { user } = await openDialog();

    await user.click(
      screen.getByRole("button", { name: "chat.delete.confirm" }),
    );

    expect(
      screen.getByRole("button", { name: "chat.delete.confirm" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "chat.delete.cancel" }),
    ).toBeDisabled();
  });

  it("reports a conversation that is already gone in its own words", async () => {
    apiRequest.mockResolvedValue({ ok: false, code: "not_found" });
    const { user } = await openDialog();

    await user.click(
      screen.getByRole("button", { name: "chat.delete.confirm" }),
    );

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: "chat.errors.notFound",
        type: "error",
      }),
    );
  });
});
