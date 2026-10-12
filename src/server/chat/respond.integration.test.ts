import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { actorOf, createUserRow } from "@/server/testing/fixtures";

type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

const agentModule = vi.hoisted(() => ({
  current: undefined as unknown,
}));

vi.mock("@/server/chat/agent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/chat/agent")>();
  return {
    ...original,
    getChatAgent: async () => agentModule.current,
  };
});

const { createChatAgent } = await import("@/server/chat/agent");
const { respondToChat } = await import("@/server/chat/respond");

const USAGE = {
  inputTokens: {
    total: 7,
    noCache: 7,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 9, text: 5, reasoning: 4 },
};

function answer(finishReason: "stop" | "length" = "stop"): StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "reasoning-start", id: "r" },
    { type: "reasoning-delta", id: "r", delta: "Considering inverters." },
    { type: "reasoning-end", id: "r" },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: "An inverter " },
    { type: "text-delta", id: "t", delta: "converts DC to AC." },
    { type: "text-end", id: "t" },
    {
      type: "finish",
      usage: USAGE,
      finishReason: { unified: finishReason, raw: undefined },
    },
  ];
}

function useModel(chunks: StreamPart[], modelId = "mock-model-7") {
  const model = new MockLanguageModelV4({
    modelId,
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
  });
  agentModule.current = {
    agent: createChatAgent(model),
    modelId: model.modelId,
  };
  return model;
}

type Chunk = { type: string; [key: string]: unknown };

async function chunksOf(response: Response): Promise<Chunk[]> {
  const body = await response.text();
  return body
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice("data: ".length)) as Chunk);
}

async function endedReply(replyId: string) {
  return vi.waitFor(async () => {
    const reply = await db.message.findUniqueOrThrow({
      where: { id: replyId },
    });
    if (reply.finishReason === "IN_PROGRESS") throw new Error("still running");
    return reply;
  });
}

const send = { trigger: "submit-message", locale: "en", text: "How?" } as const;

beforeEach(() => {
  agentModule.current = undefined;
});

describe("respondToChat", () => {
  it("names the reply with its stored id and carries the conversation id at the start", async () => {
    useModel(answer());
    const user = await createUserRow();

    const chunks = await chunksOf(
      await respondToChat(actorOf(user), send, new AbortController().signal),
    );

    const reply = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
      include: { conversation: true },
    });
    expect(chunks[0]).toMatchObject({
      type: "start",
      messageId: reply.id,
      messageMetadata: { conversationId: reply.conversationId },
    });
  });

  it("streams the reasoning and the text", async () => {
    useModel(answer());
    const user = await createUserRow();

    const chunks = await chunksOf(
      await respondToChat(actorOf(user), send, new AbortController().signal),
    );
    const types = chunks.map((chunk) => chunk.type);

    expect(types).toContain("reasoning-delta");
    expect(types.indexOf("reasoning-delta")).toBeLessThan(
      types.indexOf("text-delta"),
    );
    expect(
      chunks
        .filter((chunk) => chunk.type === "text-delta")
        .map((chunk) => chunk.delta)
        .join(""),
    ).toBe("An inverter converts DC to AC.");
    expect(chunks.at(-1)).toMatchObject({
      type: "finish",
      messageMetadata: { outcome: "completed" },
    });
  });

  it("stores the completed reply with its reasoning, usage, and the model that answered (FR-048)", async () => {
    useModel(answer(), "mock-model-7");
    const user = await createUserRow();

    await chunksOf(
      await respondToChat(actorOf(user), send, new AbortController().signal),
    );
    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });

    expect(await endedReply(id)).toMatchObject({
      finishReason: "COMPLETED",
      parts: [
        expect.objectContaining({
          type: "reasoning",
          text: "Considering inverters.",
        }),
        expect.objectContaining({
          type: "text",
          text: "An inverter converts DC to AC.",
        }),
      ],
      inputTokens: 7,
      outputTokens: 9,
      model: "mock-model-7",
    });
  });

  it("stores a reply that reached the token cap as cut and says so at the finish (FR-052)", async () => {
    useModel(answer("length"));
    const user = await createUserRow();

    const chunks = await chunksOf(
      await respondToChat(actorOf(user), send, new AbortController().signal),
    );
    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });

    expect(chunks.at(-1)).toMatchObject({
      type: "finish",
      messageMetadata: { outcome: "cut" },
    });
    expect((await endedReply(id)).finishReason).toBe("CUT");
  });

  it("sends the model the instructions with the page language and today's date", async () => {
    const model = useModel(answer());
    const user = await createUserRow();

    await chunksOf(
      await respondToChat(
        actorOf(user),
        { ...send, locale: "uk" },
        new AbortController().signal,
      ),
    );

    const [system] = model.doStreamCalls[0].prompt;
    expect(system.role).toBe("system");
    expect(system.content).toMatch(/Ukrainian/);
    expect(system.content).toContain(new Date().toISOString().slice(0, 10));
  });

  it("asks the model for medium reasoning with summaries, within one 4 096-token cap (FR-052, FR-054)", async () => {
    const model = useModel(answer());
    const user = await createUserRow();

    await chunksOf(
      await respondToChat(actorOf(user), send, new AbortController().signal),
    );

    const [call] = model.doStreamCalls;
    expect(call.maxOutputTokens).toBe(4096);
    expect(call.providerOptions?.google).toEqual({
      thinkingConfig: { thinkingLevel: "medium", includeThoughts: true },
    });
  });
});

function slowAnswer(): StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "reasoning-start", id: "r" },
    { type: "reasoning-delta", id: "r", delta: "Considering." },
    { type: "reasoning-end", id: "r" },
    { type: "text-start", id: "t" },
    ...Array.from({ length: 40 }, (_, index): StreamPart => ({
      type: "text-delta",
      id: "t",
      delta: `word${index} `,
    })),
    { type: "text-end", id: "t" },
    {
      type: "finish",
      usage: USAGE,
      finishReason: { unified: "stop", raw: undefined },
    },
  ];
}

function useSlowModel() {
  const model = new MockLanguageModelV4({
    modelId: "mock-model-7",
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: slowAnswer(),
        chunkDelayInMs: 20,
      }),
    }),
  });
  agentModule.current = {
    agent: createChatAgent(model),
    modelId: model.modelId,
  };
}

/** Reads the stream until `until` holds for a chunk, aborts, then drains what is left. */
async function abortWhen(
  response: Response,
  controller: AbortController,
  until: (chunk: Chunk) => boolean,
) {
  const reader = response
    .body!.pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = "";
  let aborted = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    if (aborted) continue;
    const chunks = buffer
      .split("\n")
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice("data: ".length)) as Chunk);
    if (chunks.some(until)) {
      controller.abort();
      aborted = true;
    }
  }
}

describe("respondToChat — Stop (FR-016, FR-018)", () => {
  it("stores the reply as stopped with what arrived before the abort, reasoning included", async () => {
    useSlowModel();
    const user = await createUserRow();
    const controller = new AbortController();

    const response = await respondToChat(
      actorOf(user),
      send,
      controller.signal,
    );
    await abortWhen(
      response,
      controller,
      (chunk) => chunk.type === "text-delta",
    );

    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });
    const reply = await endedReply(id);
    expect(reply.finishReason).toBe("STOPPED");
    const parts = reply.parts as { type: string; text: string }[];
    expect(parts[0]).toMatchObject({ type: "reasoning", text: "Considering." });
    const text = parts.find((part) => part.type === "text")?.text ?? "";
    expect(text).toMatch(/^word0 /);
    expect(text).not.toContain("word39");
  });

  it("stores a reply stopped before any text with its reasoning only", async () => {
    useSlowModel();
    const user = await createUserRow();
    const controller = new AbortController();

    const response = await respondToChat(
      actorOf(user),
      send,
      controller.signal,
    );
    await abortWhen(
      response,
      controller,
      (chunk) => chunk.type === "reasoning-delta",
    );

    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });
    const reply = await endedReply(id);
    expect(reply.finishReason).toBe("STOPPED");
    expect(
      (reply.parts as { type: string }[]).map((part) => part.type),
    ).toEqual(["reasoning"]);
  });
});

describe("respondToChat — failures (FR-014, FR-017, FR-020)", () => {
  it("stores a reply that fails mid-stream as failed, and tells the browser only model_failed", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    useModel([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Half an answer" },
      {
        type: "error",
        error: new Error("Provider says: quota exceeded for project 42"),
      },
    ]);
    const user = await createUserRow();

    const response = await respondToChat(
      actorOf(user),
      send,
      new AbortController().signal,
    );
    const body = await response.text();
    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });

    expect(body).toContain('"errorText":"model_failed"');
    expect(body).not.toContain("quota");
    const reply = await endedReply(id);
    expect(reply.finishReason).toBe("FAILED");
    expect(reply.parts).toEqual([
      expect.objectContaining({ type: "text", text: "Half an answer" }),
    ]);
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes("quota")),
    ).toBe(true);
    consoleError.mockRestore();
  });

  it("stores the question and a failed reply when the model throws at call time", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const model = new MockLanguageModelV4({
      modelId: "mock-model-7",
      doStream: async () => {
        throw new Error("Provider unavailable");
      },
    });
    agentModule.current = {
      agent: createChatAgent(model),
      modelId: model.modelId,
    };
    const user = await createUserRow();

    const response = await respondToChat(
      actorOf(user),
      send,
      new AbortController().signal,
    ).catch(() => null);
    await response?.text();

    const question = await db.message.findFirstOrThrow({
      where: { role: "USER" },
    });
    expect(question.parts).toEqual([{ type: "text", text: "How?" }]);
    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });
    expect((await endedReply(id)).finishReason).toBe("FAILED");
    consoleError.mockRestore();
  });

  it("ends a reply that outlasts the timeout as failed, not stopped", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const model = new MockLanguageModelV4({
      modelId: "mock-model-7",
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: slowAnswer(),
          chunkDelayInMs: 50,
        }),
      }),
    });
    agentModule.current = {
      agent: createChatAgent(model),
      modelId: model.modelId,
    };
    const user = await createUserRow();

    const chunks = await chunksOf(
      await respondToChat(
        actorOf(user),
        send,
        new AbortController().signal,
        new Date(),
        300,
      ),
    );
    const { id } = await db.message.findFirstOrThrow({
      where: { role: "ASSISTANT" },
    });

    expect((await endedReply(id)).finishReason).toBe("FAILED");
    expect(
      chunks.some(
        (chunk) =>
          (chunk.messageMetadata as { outcome?: string } | undefined)
            ?.outcome === "failed",
      ),
    ).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("respondToChat — limits (SC-008)", () => {
  it("never calls the model for a request refused by a limit", async () => {
    const model = useModel(answer());
    const user = await createUserRow();
    const now = new Date();
    const conversation = await db.conversation.create({
      data: { userId: user.id, title: "Busy", createdAt: now, updatedAt: now },
    });
    await db.message.createMany({
      data: Array.from({ length: 10 }, () => ({
        conversationId: conversation.id,
        role: "ASSISTANT" as const,
        parts: [],
        createdAt: now,
        finishReason: "COMPLETED" as const,
      })),
    });

    await expect(
      respondToChat(actorOf(user), send, new AbortController().signal, now),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(model.doStreamCalls).toEqual([]);
  });
});
