import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const chatFetch = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next-intl", () => import("@/testing/next-intl-mock"));
vi.mock("@/lib/http/client/chat-fetch", () => ({ chatFetch }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    `/${locale}${href}`,
}));

import type { ChatUIMessage } from "@/lib/chat/messages";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

import { ChatPanel } from "./chat-panel";

const CONVERSATION = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollTo ??= () => {};
});

beforeEach(() => {
  chatFetch.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  vi.spyOn(window.history, "replaceState");
});

function stream(chunks: object[]): Response {
  const body = [...chunks.map((chunk) => JSON.stringify(chunk)), "[DONE]"]
    .map((data) => `data: ${data}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const answer = (conversationId = CONVERSATION) =>
  stream([
    {
      type: "start",
      messageId: "reply-1",
      messageMetadata: { conversationId },
    },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: "Test reply" },
    { type: "text-end", id: "t" },
    { type: "finish", messageMetadata: { outcome: "completed" } },
  ]);

const bodyOf = (call: number) =>
  JSON.parse(chatFetch.mock.calls[call][1].body as string);

async function send(text: string) {
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", { name: "chat.composer.label" });
  await user.type(input, `${text}{Enter}`);
  return input;
}

describe("ChatPanel", () => {
  it("sends only the new text, the locale, and the trigger for a new conversation", async () => {
    chatFetch.mockResolvedValue(answer());
    render(<ChatPanel initialMessages={[]} maxLength={100} />);

    await send("How does an inverter work?");

    await waitFor(() => expect(chatFetch).toHaveBeenCalledTimes(1));
    expect(chatFetch.mock.calls[0][0]).toBe("/api/chat");
    expect(bodyOf(0)).toEqual({
      locale: "en",
      trigger: "submit-message",
      text: "How does an inverter work?",
    });
  });

  it("sends the conversation id for an existing conversation", async () => {
    chatFetch.mockResolvedValue(answer());
    const messages: ChatUIMessage[] = [
      { id: "q0", role: "user", parts: [{ type: "text", text: "Before" }] },
      {
        id: "r0",
        role: "assistant",
        parts: [{ type: "text", text: "Earlier" }],
        metadata: { outcome: "completed" },
      },
    ];
    render(
      <ChatPanel
        conversationId={CONVERSATION}
        initialMessages={messages}
        maxLength={100}
      />,
    );

    await send("Next");

    await waitFor(() => expect(chatFetch).toHaveBeenCalledTimes(1));
    expect(bodyOf(0)).toEqual({
      conversationId: CONVERSATION,
      locale: "en",
      trigger: "submit-message",
      text: "Next",
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("moves a new conversation to its own address at the start, then to its page at the end (FR-007)", async () => {
    chatFetch.mockResolvedValue(answer());
    render(<ChatPanel initialMessages={[]} maxLength={100} />);

    await send("Hi");

    await waitFor(() =>
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        `/en/dashboard/chat/${CONVERSATION}`,
      ),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        `/dashboard/chat/${CONVERSATION}`,
      ),
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(await screen.findByText("Test reply")).toBeInTheDocument();
  });

  it("puts a refused message back in the box and says why (FR-041)", async () => {
    chatFetch.mockResolvedValue(
      Response.json(
        { error: { code: "rate_limited", retryAfterSeconds: 20 } },
        { status: 429 },
      ),
    );
    render(<ChatPanel initialMessages={[]} maxLength={100} />);

    const input = await send("Too soon");

    expect(
      await screen.findByText("chat.errors.rateLimited"),
    ).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue("Too soon"));
    expect(
      screen.queryByText("Too soon", { selector: "p, span, div" }),
    ).toBeNull();
    expect(screen.getByText("chat.greeting")).toBeInTheDocument();
  });

  it("shows a field's validation message for a refused message", async () => {
    chatFetch.mockResolvedValue(
      Response.json(
        {
          error: {
            code: "validation_failed",
            fields: { text: ["validation.chat.empty"] },
          },
        },
        { status: 400 },
      ),
    );
    render(<ChatPanel initialMessages={[]} maxLength={100} />);

    await send("x");

    expect(
      await screen.findByText("validation.chat.empty"),
    ).toBeInTheDocument();
  });

  it("clears the alert when the next message is sent", async () => {
    chatFetch
      .mockResolvedValueOnce(
        Response.json({ error: { code: "rate_limited" } }, { status: 429 }),
      )
      .mockResolvedValueOnce(answer());
    render(<ChatPanel initialMessages={[]} maxLength={100} />);

    await send("Once");
    await screen.findByText("chat.errors.rateLimited");
    await userEvent
      .setup()
      .type(
        screen.getByRole("textbox", { name: "chat.composer.label" }),
        "{Enter}",
      );

    await waitFor(() => expect(chatFetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("chat.errors.rateLimited")).toBeNull(),
    );
  });

  const failedConversation: ChatUIMessage[] = [
    { id: "q1", role: "user", parts: [{ type: "text", text: "Check" }] },
    {
      id: "f1",
      role: "assistant",
      parts: [{ type: "text", text: "Half an answer" }],
      metadata: { outcome: "failed" },
    },
  ];

  it("tries again without the text, keeping the failed reply above the new one (FR-022, SC-006)", async () => {
    chatFetch.mockResolvedValue(answer());
    const user = userEvent.setup();
    render(
      <ChatPanel
        conversationId={CONVERSATION}
        initialMessages={failedConversation}
        maxLength={100}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "chat.actions.tryAgain" }),
    );

    await waitFor(() => expect(chatFetch).toHaveBeenCalledTimes(1));
    expect(bodyOf(0)).toEqual({
      conversationId: CONVERSATION,
      locale: "en",
      trigger: "regenerate-message",
    });
    expect(await screen.findByText("Test reply")).toBeInTheDocument();
    expect(screen.getByText("Half an answer")).toBeInTheDocument();
    expect(screen.getAllByText("Check")).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("puts the failed reply back when Try again is refused", async () => {
    chatFetch.mockResolvedValue(
      Response.json({ error: { code: "nothing_to_retry" } }, { status: 409 }),
    );
    const user = userEvent.setup();
    render(
      <ChatPanel
        conversationId={CONVERSATION}
        initialMessages={failedConversation}
        maxLength={100}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "chat.actions.tryAgain" }),
    );

    expect(
      await screen.findByText("chat.errors.nothingToRetry"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "chat.actions.tryAgain" }),
    ).toBeInTheDocument();
  });

  it.each([
    [7_260, "chat.errors.dailyLimitHours"],
    [1_200, "chat.errors.dailyLimitUnderHour"],
  ])(
    "says when the chat is available again after the daily limit (%i s, FR-055)",
    async (retryAfterSeconds, key) => {
      chatFetch.mockResolvedValue(
        Response.json(
          { error: { code: "daily_limit_reached", retryAfterSeconds } },
          { status: 429 },
        ),
      );
      render(<ChatPanel initialMessages={[]} maxLength={100} />);

      await send("Over budget");

      expect(await screen.findByText(key)).toBeInTheDocument();
    },
  );
});

describe("the daily-limit message's plural (FR-055)", () => {
  it.each([
    ["en", 1, "about 1 hour."],
    ["en", 3, "about 3 hours."],
    ["uk", 1, "через 1 годину."],
    ["uk", 3, "через 3 години."],
    ["uk", 5, "через 5 годин."],
    ["uk", 21, "через 21 годину."],
  ] as const)("reads naturally in %s for %i", async (locale, hours, ending) => {
    const { createTranslator } =
      await vi.importActual<typeof import("next-intl")>("next-intl");
    const t = createTranslator({
      locale,
      messages: locale === "en" ? en : uk,
    });

    expect(t("chat.errors.dailyLimitHours", { hours })).toMatch(
      new RegExp(`${ending.replace(".", "\\.")}$`),
    );
  });
});
