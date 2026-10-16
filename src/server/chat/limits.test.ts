import { describe, expect, it } from "vitest";

import { secondsUntilBudgetFrees } from "@/server/chat/limits";

const now = new Date("2026-10-04T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const reply = (
  hoursAgo: number,
  inputTokens: number | null,
  outputTokens: number | null,
) => ({
  createdAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000),
  inputTokens,
  outputTokens,
});

describe("secondsUntilBudgetFrees (FR-055)", () => {
  it("waits for the oldest reply to leave the window when the total is just at the budget", () => {
    const replies = [reply(20, 30, 20), reply(10, 30, 20)];

    expect(secondsUntilBudgetFrees(replies, 100, now)).toBe(4 * 60 * 60);
  });

  it("waits for the first reply whose leaving is enough, oldest first", () => {
    const replies = [reply(23, 1, 0), reply(12, 500, 400), reply(1, 50, 49)];

    expect(secondsUntilBudgetFrees(replies, 900, now)).toBe(12 * 60 * 60);
  });

  it("counts tokens never reported as zero", () => {
    const replies = [
      reply(23, null, null),
      reply(5, 60, null),
      reply(2, null, 40),
    ];

    expect(secondsUntilBudgetFrees(replies, 100, now)).toBe(19 * 60 * 60);
  });

  it("rounds a part of a second up", () => {
    const replies = [
      {
        createdAt: new Date(now.getTime() - DAY + 1500),
        inputTokens: 100,
        outputTokens: 0,
      },
    ];

    expect(secondsUntilBudgetFrees(replies, 100, now)).toBe(2);
  });

  it("always answers a wait of at least one second while the budget is used up", () => {
    const replies = [
      {
        createdAt: new Date(now.getTime() - DAY + 1),
        inputTokens: 150,
        outputTokens: 0,
      },
    ];

    expect(secondsUntilBudgetFrees(replies, 100, now)).toBeGreaterThan(0);
  });

  it("takes the replies in any order", () => {
    const replies = [reply(10, 30, 20), reply(20, 30, 20)];

    expect(secondsUntilBudgetFrees(replies, 100, now)).toBe(4 * 60 * 60);
  });
});
