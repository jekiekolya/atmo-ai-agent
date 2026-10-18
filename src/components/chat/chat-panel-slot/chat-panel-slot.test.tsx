import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));
vi.mock("@/components/chat/chat-panel/chat-panel", () => ({
  ChatPanel: () => <div data-testid="panel" />,
}));

import { ChatPanelHost } from "@/components/chat/chat-panel-host/chat-panel-host";

import { ChatPanelSlot } from "./chat-panel-slot";

const page = (
  <ChatPanelHost maxLength={100}>
    <ChatPanelSlot initialMessages={[]} />
  </ChatPanelHost>
);

describe("ChatPanelSlot", () => {
  it("serves the loader, not the panel, until the client can open the thread at its end (FR-010)", () => {
    const html = renderToString(page);

    expect(html).toContain('role="status"');
    expect(html).not.toContain('data-testid="panel"');
  });

  it("brings in the panel on the client, without a loader", () => {
    const { container, getByTestId } = render(page);

    expect(getByTestId("panel")).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
