import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;
type CallOptions = Parameters<MockLanguageModelV4["doStream"]>[0];

const USAGE = {
  inputTokens: {
    total: 12,
    noCache: 12,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 34, text: 34, reasoning: undefined },
};

function latestUserText(prompt: CallOptions["prompt"]): string {
  const message = prompt.findLast((entry) => entry.role === "user");
  if (!message || message.role !== "user") return "";
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function words(text: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? text : ` ${text}`,
  );
}

/** The deterministic model behind AI_FAKE_MODEL (FR-051, R13); markers in the text steer it. */
export function createFakeModel({
  chunkDelayInMs,
}: { chunkDelayInMs?: number } = {}) {
  const failedOnce = new Set<string>();

  return new MockLanguageModelV4({
    provider: "fake",
    modelId: "fake-model",
    doStream: async ({ prompt }) => {
      const text = latestUserText(prompt);
      const slow = text.includes("[slow]");
      const fails =
        text.includes("[fail]") ||
        (text.includes("[fail-once]") && !failedOnce.has(text));
      if (text.includes("[fail-once]")) failedOnce.add(text);

      const reply = slow
        ? words("Test reply, slowly.", 40)
        : [`Test reply: `, `you `, `wrote `, `"${text}".`];

      const chunks: StreamPart[] = [
        { type: "stream-start", warnings: [] },
        { type: "reasoning-start", id: "reasoning-1" },
        {
          type: "reasoning-delta",
          id: "reasoning-1",
          delta: `Thinking about "${text}".`,
        },
        { type: "reasoning-end", id: "reasoning-1" },
        { type: "text-start", id: "text-1" },
        ...(fails ? reply.slice(0, 2) : reply).map((delta): StreamPart => ({
          type: "text-delta",
          id: "text-1",
          delta,
        })),
      ];

      if (fails) {
        chunks.push({ type: "error", error: new Error("Fake model failure") });
      } else {
        chunks.push(
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            usage: USAGE,
            finishReason: text.includes("[cut]")
              ? { unified: "length", raw: "MAX_TOKENS" }
              : { unified: "stop", raw: "STOP" },
          },
        );
      }

      return {
        stream: simulateReadableStream({
          chunks,
          chunkDelayInMs: chunkDelayInMs ?? (slow ? 150 : 60),
        }),
      };
    },
  });
}
