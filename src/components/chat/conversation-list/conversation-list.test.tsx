import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/dashboard/chat" }));

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props} />
  ),
}));

import { ConversationList } from "./conversation-list";

const conversations = [
  { id: "c-2", title: "Batteries" },
  { id: "c-1", title: "Inverters" },
];

describe("ConversationList", () => {
  it("lists conversations as links, in the order given, inside a labelled nav (FR-029)", () => {
    render(<ConversationList conversations={conversations} />);

    const nav = screen.getByRole("navigation", { name: "chat.list.label" });
    const links = within(nav).getAllByRole("link");
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Batteries", "/dashboard/chat/c-2"],
      ["Inverters", "/dashboard/chat/c-1"],
    ]);
  });

  it("marks the open conversation as the current page", () => {
    pathname.current = "/dashboard/chat/c-1";
    render(<ConversationList conversations={conversations} />);

    expect(screen.getByRole("link", { name: "Inverters" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Batteries" })).not.toHaveAttribute(
      "aria-current",
    );
    pathname.current = "/dashboard/chat";
  });

  it("offers New chat (FR-030)", () => {
    render(<ConversationList conversations={conversations} />);
    expect(
      screen.getByRole("link", { name: "chat.list.newChat" }),
    ).toHaveAttribute("href", "/dashboard/chat");
  });

  it("offers Delete on every row (FR-032)", () => {
    render(<ConversationList conversations={conversations} />);
    expect(
      screen.getAllByRole("button", { name: "chat.list.delete" }),
    ).toHaveLength(2);
  });

  it("says so when there are no conversations", () => {
    render(<ConversationList conversations={[]} />);
    expect(screen.getByText("chat.list.empty")).toBeInTheDocument();
  });

  it("folds away behind a toggle that reports its state (FR-034)", async () => {
    const user = userEvent.setup();
    render(<ConversationList conversations={conversations} />);
    const toggle = screen.getByRole("button", { name: "chat.list.toggle" });
    const nav = screen.getByRole("navigation", { hidden: true });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveClass("block");
  });
});
