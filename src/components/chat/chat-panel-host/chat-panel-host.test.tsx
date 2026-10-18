import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/components/chat/chat-panel/chat-panel", async () => {
  const { useEffect } = await import("react");
  return {
    ChatPanel: ({
      conversationId,
      initialMessages,
      onConversationStarted,
    }: {
      conversationId?: string;
      initialMessages: unknown[];
      onConversationStarted: (id: string) => void;
    }) => {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return (
        <div
          data-testid="panel"
          data-conversation={conversationId ?? "new"}
          data-messages={initialMessages.length}
        >
          <button onClick={() => onConversationStarted("c1")}>start</button>
        </div>
      );
    },
  };
});

import { ChatPanelSlot } from "@/components/chat/chat-panel-slot/chat-panel-slot";
import type { ChatUIMessage } from "@/lib/chat/messages";

import { ChatPanelHost } from "./chat-panel-host";

const stored: ChatUIMessage[] = [
  { id: "q1", role: "user", parts: [{ type: "text", text: "Hi" }] },
];

const host = (page: React.ReactNode) => (
  <ChatPanelHost maxLength={100}>{page}</ChatPanelHost>
);

beforeEach(() => {
  mounts.count = 0;
});

describe("ChatPanelHost", () => {
  it("keeps the panel when a new conversation's own page takes over (FR-007)", async () => {
    const { rerender } = render(
      host(<ChatPanelSlot key="new" initialMessages={[]} />),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "start" }));

    rerender(
      host(
        <ChatPanelSlot key="c1" conversationId="c1" initialMessages={stored} />,
      ),
    );

    expect(mounts.count).toBe(1);
    expect(screen.getByTestId("panel")).toHaveAttribute(
      "data-conversation",
      "c1",
    );
  });

  it("keeps the panel when its page renders again with the stored messages", () => {
    const { rerender } = render(
      host(<ChatPanelSlot conversationId="c1" initialMessages={[]} />),
    );

    rerender(
      host(<ChatPanelSlot conversationId="c1" initialMessages={stored} />),
    );

    expect(mounts.count).toBe(1);
  });

  it("opens a new panel for another conversation", () => {
    const { rerender } = render(
      host(<ChatPanelSlot key="c1" conversationId="c1" initialMessages={[]} />),
    );

    rerender(
      host(
        <ChatPanelSlot key="c2" conversationId="c2" initialMessages={stored} />,
      ),
    );

    expect(mounts.count).toBe(2);
    const panel = screen.getByTestId("panel");
    expect(panel).toHaveAttribute("data-conversation", "c2");
    expect(panel).toHaveAttribute("data-messages", "1");
  });

  it("opens an empty panel for New chat after a conversation", () => {
    const { rerender } = render(
      host(
        <ChatPanelSlot key="c1" conversationId="c1" initialMessages={stored} />,
      ),
    );

    rerender(host(<ChatPanelSlot key="new" initialMessages={[]} />));

    expect(mounts.count).toBe(2);
    expect(screen.getByTestId("panel")).toHaveAttribute(
      "data-conversation",
      "new",
    );
  });

  it("shows no panel when the page has none, as beside the chat's not-found page", () => {
    const { rerender } = render(
      host(<ChatPanelSlot conversationId="c1" initialMessages={stored} />),
    );

    rerender(host(<p>Conversation not found</p>));

    expect(screen.queryByTestId("panel")).toBeNull();
    expect(screen.getByText("Conversation not found")).toBeInTheDocument();
  });
});
