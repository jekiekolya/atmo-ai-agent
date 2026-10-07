import { streamText } from "ai";
import { describe, expect, it } from "vitest";

import { createFakeModel } from "@/server/chat/fake-model";

type Part = { type: string; [key: string]: unknown };

async function partsOf(
  model: ReturnType<typeof createFakeModel>,
  text: string,
): Promise<Part[]> {
  const result = streamText({
    model,
    messages: [{ role: "user", content: text }],
    onError: () => undefined,
  });
  const parts: Part[] = [];
  for await (const part of result.fullStream) parts.push(part as Part);
  return parts;
}

const types = (parts: Part[]) =>
  parts
    .map((part) => part.type)
    .filter((type) =>
      [
        "reasoning-delta",
        "text-delta",
        "finish",
        "error",
        "reasoning-start",
        "text-start",
      ].includes(type),
    );

const fast = () => createFakeModel({ chunkDelayInMs: 0 });

describe("createFakeModel", () => {
  it("reports its own model id", () => {
    expect(fast().modelId).toBe("fake-model");
  });

  it("streams reasoning first, then text, then a stop with fixed usage", async () => {
    const parts = await partsOf(fast(), "How does an inverter work?");
    const order = types(parts);

    expect(order.indexOf("reasoning-start")).toBeLessThan(
      order.indexOf("text-start"),
    );
    expect(order.at(-1)).toBe("finish");
    expect(
      order.filter((type) => type === "text-delta").length,
    ).toBeGreaterThan(1);

    const finish = parts.at(-1)!;
    expect(finish.finishReason).toBe("stop");
    expect(finish.totalUsage).toMatchObject({
      inputTokens: 12,
      outputTokens: 34,
    });

    const text = parts
      .filter((part) => part.type === "text-delta")
      .map((part) => part.text)
      .join("");
    expect(text).toContain("How does an inverter work?");
  });

  it("streams at least 30 text chunks for [slow]", async () => {
    const parts = await partsOf(fast(), "Explain [slow]");

    expect(
      parts.filter((part) => part.type === "text-delta").length,
    ).toBeGreaterThanOrEqual(30);
  });

  it("fails with an error part for [fail]", async () => {
    const parts = await partsOf(fast(), "Check [fail]");

    expect(types(parts)).toContain("error");
    expect(types(parts)).toContain("text-delta");
  });

  it("fails the first time a [fail-once] text is seen, then succeeds", async () => {
    const model = fast();

    expect(types(await partsOf(model, "Check [fail-once] A"))).toContain(
      "error",
    );
    expect(types(await partsOf(model, "Check [fail-once] B"))).toContain(
      "error",
    );
    expect(types(await partsOf(model, "Check [fail-once] A"))).not.toContain(
      "error",
    );
  });

  it("finishes with length for [cut]", async () => {
    const parts = await partsOf(fast(), "Long [cut]");

    expect(parts.at(-1)).toMatchObject({
      type: "finish",
      finishReason: "length",
    });
  });
});
