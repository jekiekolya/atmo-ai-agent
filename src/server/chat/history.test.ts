import { describe, expect, it } from "vitest";

import { type HistoryRow, toModelHistory } from "@/server/chat/history";

const question = (id: string, text: string): HistoryRow => ({
  id,
  role: "USER",
  parts: [{ type: "text", text }],
  finishReason: null,
});

const reply = (
  id: string,
  text: string,
  finishReason: HistoryRow["finishReason"] = "COMPLETED",
): HistoryRow => ({
  id,
  role: "ASSISTANT",
  parts: [
    { type: "reasoning", text: `thinking ${id}` },
    { type: "text", text },
  ],
  finishReason,
});

describe("toModelHistory", () => {
  it("keeps the order and the stored ids, as UI messages", () => {
    expect(
      toModelHistory([question("q1", "Hi"), reply("r1", "Hello")], 50),
    ).toEqual([
      { id: "q1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      { id: "r1", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
    ]);
  });

  it("removes reasoning but keeps the text of a reply", () => {
    const [, answer] = toModelHistory(
      [question("q1", "Hi"), reply("r1", "A")],
      50,
    );
    expect(answer.parts).toEqual([{ type: "text", text: "A" }]);
  });

  it.each(["FAILED", "IN_PROGRESS"] as const)(
    "drops a reply that is %s",
    (finishReason) => {
      const history = toModelHistory(
        [
          question("q1", "Hi"),
          reply("r1", "partial", finishReason),
          question("q2", "Again"),
        ],
        50,
      );
      expect(history.map((message) => message.id)).toEqual(["q1", "q2"]);
    },
  );

  it.each(["STOPPED", "CUT"] as const)(
    "keeps a reply that is %s",
    (finishReason) => {
      const history = toModelHistory(
        [question("q1", "Hi"), reply("r1", "partial", finishReason)],
        50,
      );
      expect(history.map((message) => message.id)).toEqual(["q1", "r1"]);
    },
  );

  it("drops a reply left with nothing once its reasoning is removed", () => {
    const stoppedEarly: HistoryRow = {
      id: "r1",
      role: "ASSISTANT",
      parts: [{ type: "reasoning", text: "thinking" }],
      finishReason: "STOPPED",
    };
    expect(
      toModelHistory(
        [question("q1", "Hi"), stoppedEarly, question("q2", "Hm")],
        50,
      ).map((message) => message.id),
    ).toEqual(["q1", "q2"]);
  });

  it("keeps only the last messages up to the limit, the new question included", () => {
    const rows = [
      question("q1", "1"),
      reply("r1", "1"),
      question("q2", "2"),
      reply("r2", "2"),
      question("q3", "3"),
      reply("r3", "wip", "IN_PROGRESS"),
    ];
    expect(toModelHistory(rows, 3).map((message) => message.id)).toEqual([
      "q2",
      "r2",
      "q3",
    ]);
  });
});
