import {
  type AppendMessage,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));

import { ChatThread } from "./chat-thread";

beforeAll(() => {
  // jsdom lacks the layout APIs assistant-ui's viewport calls.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollTo ??= () => {};
});

function Harness({
  messages,
  isRunning = false,
  onNew = vi.fn(),
  onCancel,
  alert,
  onTryAgain,
  maxLength = 100,
}: {
  messages: ThreadMessageLike[];
  isRunning?: boolean;
  onNew?: (message: AppendMessage) => Promise<void>;
  onCancel?: () => Promise<void>;
  alert?: string;
  onTryAgain?: () => void;
  maxLength?: number;
}) {
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    onNew,
    onCancel,
    convertMessage: (message: ThreadMessageLike) => message,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatThread maxLength={maxLength} alert={alert} onTryAgain={onTryAgain} />
    </AssistantRuntimeProvider>
  );
}

const question = (text: string, id = "q1"): ThreadMessageLike => ({
  id,
  role: "user",
  content: [{ type: "text", text }],
});

const reply = (
  content: ThreadMessageLike["content"],
  custom: Record<string, unknown> = {},
  id = "r1",
): ThreadMessageLike => ({
  id,
  role: "assistant",
  content,
  status: { type: "complete", reason: "stop" },
  metadata: { custom },
});

describe("ChatThread", () => {
  it("greets on an empty thread (FR-027)", () => {
    render(<Harness messages={[]} />);
    expect(screen.getByText("chat.greeting")).toBeInTheDocument();
  });

  it("shows the user's message as plain text, as typed (FR-025)", () => {
    render(<Harness messages={[question("**not bold**\nsecond line")]} />);

    const text = screen.getByText(/\*\*not bold\*\*/);
    expect(text.closest(".whitespace-pre-wrap")).not.toBeNull();
    expect(document.querySelector("strong")).toBeNull();
    expect(screen.queryByText("chat.greeting")).toBeNull();
  });

  it("renders a reply as Markdown, with no image fetched (FR-024)", async () => {
    render(
      <Harness
        messages={[
          question("Hi"),
          reply([
            {
              type: "text",
              text: "**Bold** and ![x](https://example.com/x.png) <b>raw</b>",
            },
          ]),
        ]}
      />,
    );

    expect(await screen.findByText("Bold")).toContainHTML("Bold");
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
  });

  it("collapses the reasoning of an ended reply under its label (FR-028, FR-053)", async () => {
    render(
      <Harness
        messages={[
          question("Hi"),
          reply([
            { type: "reasoning", text: "Considering inverters." },
            { type: "text", text: "An answer." },
          ]),
        ]}
      />,
    );

    const trigger = await screen.findByRole("button", {
      name: /chat\.reasoning\.label/,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("chat.reasoning.thinking")).toBeNull();
  });

  it("opens the reasoning, marked as thinking, while it arrives", async () => {
    render(
      <Harness
        isRunning
        messages={[
          question("Hi"),
          {
            id: "r1",
            role: "assistant",
            content: [{ type: "reasoning", text: "Considering." }],
          },
        ]}
      />,
    );

    const trigger = await screen.findByRole("button", {
      name: /chat\.reasoning\.thinking/,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("marks a reply from its stored outcome (FR-052)", async () => {
    render(
      <Harness
        messages={[
          question("Hi"),
          reply([{ type: "text", text: "Partial" }], { outcome: "cut" }),
        ]}
      />,
    );

    expect(await screen.findByText("chat.markers.cut")).toBeInTheDocument();
  });

  it("marks nothing on a completed reply", async () => {
    render(
      <Harness
        messages={[
          question("Hi"),
          reply([{ type: "text", text: "Done" }], { outcome: "completed" }),
        ]}
      />,
    );

    await screen.findByText("Done");
    expect(screen.queryByText(/chat\.markers/)).toBeNull();
  });

  it("offers Copy on a reply with text, and not on one with reasoning only (FR-026)", async () => {
    const { unmount } = render(
      <Harness
        messages={[question("Hi"), reply([{ type: "text", text: "Answer" }])]}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "chat.actions.copy" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <Harness
        messages={[
          question("Hi"),
          reply([{ type: "reasoning", text: "Only thinking" }], {
            outcome: "stopped",
          }),
        ]}
      />,
    );
    await screen.findByText("chat.markers.stopped");
    expect(
      screen.queryByRole("button", { name: "chat.actions.copy" }),
    ).toBeNull();
  });

  it("disables Send for a blank message and sends on Enter", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn<(message: AppendMessage) => Promise<void>>(
      async () => {},
    );
    render(<Harness messages={[]} onNew={onNew} />);

    const input = screen.getByRole("textbox", { name: "chat.composer.label" });
    const send = screen.getByRole("button", { name: "chat.composer.send" });
    expect(send).toBeDisabled();

    await user.type(input, "   ");
    expect(send).toBeDisabled();

    await user.clear(input);
    await user.type(input, "First line{Shift>}{Enter}{/Shift}second line");
    expect(input).toHaveValue("First line\nsecond line");
    expect(onNew).not.toHaveBeenCalled();

    await user.type(input, "{Enter}");
    await waitFor(() => expect(onNew).toHaveBeenCalledTimes(1));
    expect(onNew.mock.calls[0][0].content).toEqual([
      { type: "text", text: "First line\nsecond line" },
    ]);
  });

  it("offers Stop instead of Send while a reply runs (FR-013)", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn(async () => {});
    render(
      <Harness
        isRunning
        onCancel={onCancel}
        messages={[
          question("Hi"),
          { id: "r1", role: "assistant", content: [] },
        ]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "chat.composer.send" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "chat.composer.stop" }),
    );
    expect(onCancel).toHaveBeenCalled();
  });

  it.each([
    ["a stopped run", { type: "incomplete", reason: "cancelled" }, {}],
    [
      "a stored stopped reply",
      { type: "complete", reason: "stop" },
      { outcome: "stopped" },
    ],
  ] as const)(
    "marks %s as stopped and offers Copy (FR-018, FR-019)",
    async (_, status, custom) => {
      render(
        <Harness
          messages={[
            question("Hi"),
            {
              id: "r1",
              role: "assistant",
              content: [{ type: "text", text: "Partial answer" }],
              status,
              metadata: { custom },
            },
          ]}
        />,
      );

      expect(
        await screen.findByText("chat.markers.stopped"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "chat.actions.copy" }),
      ).toBeInTheDocument();
    },
  );

  it("shows failed attempts under their question, each with its text and the failed marker (FR-021)", async () => {
    render(
      <Harness
        messages={[
          {
            ...question("Hi"),
            metadata: {
              custom: {
                failedAttempts: [
                  { parts: [{ type: "text", text: "Half an answer" }] },
                ],
              },
            },
          },
          reply([{ type: "text", text: "The answer" }], {
            outcome: "completed",
          }),
        ]}
      />,
    );

    expect(await screen.findByText("Half an answer")).toBeInTheDocument();
    expect(screen.getByText("chat.markers.failed")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [
      "a run that failed",
      { type: "incomplete", reason: "error", error: "model_failed" },
      {},
    ],
    [
      "a stored failed reply",
      { type: "complete", reason: "stop" },
      { outcome: "failed" },
    ],
  ] as const)(
    "offers Try again under %s, with the generic message only (FR-020, FR-022)",
    async (_, status, custom) => {
      const user = userEvent.setup();
      const onTryAgain = vi.fn();
      render(
        <Harness
          onTryAgain={onTryAgain}
          messages={[
            question("Hi"),
            {
              id: "r1",
              role: "assistant",
              content: [{ type: "text", text: "Half" }],
              status,
              metadata: { custom },
            },
          ]}
        />,
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("chat.errors.modelFailed");
      expect(document.body).not.toHaveTextContent("model_failed");
      await user.click(
        screen.getByRole("button", { name: "chat.actions.tryAgain" }),
      );
      expect(onTryAgain).toHaveBeenCalled();
    },
  );

  it("offers Try again only on the last message", async () => {
    render(
      <Harness
        onTryAgain={vi.fn()}
        messages={[
          question("Hi"),
          reply([{ type: "text", text: "Half" }], { outcome: "failed" }),
          question("Rephrased", "q2"),
          reply(
            [{ type: "text", text: "Answer" }],
            { outcome: "completed" },
            "r2",
          ),
        ]}
      />,
    );

    await screen.findByText("Answer");
    expect(screen.getByText("chat.markers.failed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "chat.actions.tryAgain" }),
    ).toBeNull();
  });

  it("offers no Try again while a reply runs", async () => {
    render(
      <Harness
        isRunning
        onTryAgain={vi.fn()}
        messages={[
          question("Hi"),
          reply([{ type: "text", text: "Half" }], { outcome: "failed" }),
        ]}
      />,
    );

    await screen.findByText("Half");
    expect(
      screen.queryByRole("button", { name: "chat.actions.tryAgain" }),
    ).toBeNull();
  });

  it("accepts a message of exactly the maximum length", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn<(message: AppendMessage) => Promise<void>>(
      async () => {},
    );
    render(<Harness messages={[]} onNew={onNew} maxLength={10} />);

    await user.type(
      screen.getByRole("textbox", { name: "chat.composer.label" }),
      "a".repeat(10),
    );

    expect(screen.queryByText("chat.errors.tooLong")).toBeNull();
    expect(
      screen.getByRole("button", { name: "chat.composer.send" }),
    ).toBeEnabled();
  });

  it("says a message one character over is too long, and will not send it (FR-036)", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn<(message: AppendMessage) => Promise<void>>(
      async () => {},
    );
    render(<Harness messages={[]} onNew={onNew} maxLength={10} />);
    const input = screen.getByRole("textbox", { name: "chat.composer.label" });

    await user.type(input, "a".repeat(11));

    expect(screen.getByText("chat.errors.tooLong")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("chat.errors.tooLong");
    expect(
      screen.getByRole("button", { name: "chat.composer.send" }),
    ).toBeDisabled();
    await user.type(input, "{Enter}");
    expect(onNew).not.toHaveBeenCalled();
  });

  it("shows the alert it is given above the composer", () => {
    render(<Harness messages={[]} alert="Refused." />);
    expect(screen.getByText("Refused.")).toBeInTheDocument();
  });
});
