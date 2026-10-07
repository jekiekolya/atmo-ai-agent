import { describe, expect, it } from "vitest";

import {
  type ChatOutcome,
  type ChatUIMessage,
  chatMessageMetadataSchema,
  effectiveOutcome,
  foldFailedReplies,
  REPLY_TIMEOUT_MS,
} from "@/lib/chat/messages";

const now = new Date("2026-10-04T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("chatMessageMetadataSchema", () => {
  it("accepts the conversation id, the outcome, and failed attempts", () => {
    const metadata = {
      conversationId: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      outcome: "cut",
      failedAttempts: [{ parts: [{ type: "text", text: "Partial" }] }],
    };

    expect(chatMessageMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it("accepts no metadata at all", () => {
    expect(chatMessageMetadataSchema.parse({})).toEqual({});
  });

  it("refuses an unknown outcome", () => {
    expect(
      chatMessageMetadataSchema.safeParse({ outcome: "exploded" }).success,
    ).toBe(false);
  });
});

describe("effectiveOutcome", () => {
  it.each([
    ["COMPLETED", "completed"],
    ["STOPPED", "stopped"],
    ["CUT", "cut"],
    ["FAILED", "failed"],
  ] as const)("reads %s as %s", (finishReason, outcome) => {
    expect(effectiveOutcome({ finishReason, createdAt: ago(0) }, now)).toBe(
      outcome,
    );
  });

  it("reads a reply being written as in progress within the timeout", () => {
    expect(
      effectiveOutcome(
        { finishReason: "IN_PROGRESS", createdAt: ago(59_999) },
        now,
      ),
    ).toBe("in_progress");
  });

  it("reads a reply left in progress past the timeout as failed (FR-015)", () => {
    expect(
      effectiveOutcome(
        { finishReason: "IN_PROGRESS", createdAt: ago(60_001) },
        now,
      ),
    ).toBe("failed");
  });

  it("times out after one minute", () => {
    expect(REPLY_TIMEOUT_MS).toBe(60_000);
  });
});

describe("foldFailedReplies (R10)", () => {
  const q = (id: string): ChatUIMessage => ({
    id,
    role: "user",
    parts: [{ type: "text", text: id }],
  });
  const r = (id: string, outcome: ChatOutcome): ChatUIMessage => ({
    id,
    role: "assistant",
    parts: [{ type: "text", text: id }],
    metadata: { outcome },
  });

  it("moves failed replies followed by another reply under their question", () => {
    const folded = foldFailedReplies([
      q("q1"),
      r("f1", "failed"),
      r("f2", "failed"),
      r("a1", "completed"),
    ]);

    expect(folded.map((message) => message.id)).toEqual(["q1", "a1"]);
    expect(folded[0].metadata?.failedAttempts).toEqual([
      { parts: [{ type: "text", text: "f1" }] },
      { parts: [{ type: "text", text: "f2" }] },
    ]);
  });

  it("leaves other replies alone", () => {
    const messages = [q("q1"), r("a1", "stopped"), q("q2"), r("a2", "cut")];
    expect(foldFailedReplies(messages)).toEqual(messages);
  });

  it("keeps a trailing failed reply as a message, so Try again can attach to it", () => {
    const folded = foldFailedReplies([
      q("q1"),
      r("f1", "failed"),
      r("f2", "failed"),
    ]);

    expect(folded.map((message) => message.id)).toEqual(["q1", "f2"]);
    expect(folded[0].metadata?.failedAttempts).toHaveLength(1);
  });

  it("keeps a failed reply followed by a new question as a message", () => {
    expect(
      foldFailedReplies([q("q1"), r("f1", "failed"), q("q2")]).map(
        (message) => message.id,
      ),
    ).toEqual(["q1", "f1", "q2"]);
  });

  it("is idempotent", () => {
    const once = foldFailedReplies([
      q("q1"),
      r("f1", "failed"),
      r("a1", "completed"),
      q("q2"),
      r("f2", "failed"),
    ]);
    expect(foldFailedReplies(once)).toEqual(once);
  });

  it("adds to attempts already folded under the question", () => {
    const folded = foldFailedReplies([
      {
        ...q("q1"),
        metadata: {
          failedAttempts: [{ parts: [{ type: "text", text: "earlier" }] }],
        },
      },
      r("f1", "failed"),
      r("a1", "completed"),
    ]);

    expect(folded[0].metadata?.failedAttempts).toHaveLength(2);
  });
});
