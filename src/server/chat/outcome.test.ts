import { describe, expect, it } from "vitest";

import { decideOutcome } from "@/server/chat/outcome";

const ended = {
  errored: false,
  isAborted: false,
  clientAborted: false,
  finishReason: "stop",
} as const;

describe("decideOutcome", () => {
  it("stores a reply that ended on its own as completed", () => {
    expect(decideOutcome(ended)).toBe("COMPLETED");
  });

  it("stores a reply after an error as failed", () => {
    expect(decideOutcome({ ...ended, errored: true })).toBe("FAILED");
  });

  it.each(["error", "content-filter"] as const)(
    "stores the finish reason %s as failed",
    (finishReason) => {
      expect(decideOutcome({ ...ended, finishReason })).toBe("FAILED");
    },
  );

  it("stores a reply the client aborted as stopped", () => {
    expect(
      decideOutcome({
        ...ended,
        isAborted: true,
        clientAborted: true,
        finishReason: undefined,
      }),
    ).toBe("STOPPED");
  });

  it("stores an abort the client did not cause, the timeout, as failed", () => {
    expect(
      decideOutcome({
        ...ended,
        isAborted: true,
        clientAborted: false,
        finishReason: undefined,
      }),
    ).toBe("FAILED");
  });

  it("stores a reply that reached the token cap as cut", () => {
    expect(decideOutcome({ ...ended, finishReason: "length" })).toBe("CUT");
  });

  it.each(["other", "tool-calls", undefined] as const)(
    "stores the finish reason %s as completed",
    (finishReason) => {
      expect(decideOutcome({ ...ended, finishReason })).toBe("COMPLETED");
    },
  );

  it("lets an error win over a client abort", () => {
    expect(
      decideOutcome({
        errored: true,
        isAborted: true,
        clientAborted: true,
        finishReason: undefined,
      }),
    ).toBe("FAILED");
  });
});
