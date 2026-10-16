import { describe, expect, it } from "vitest";

import { hoursUntilAvailable } from "@/lib/chat/availability";

describe("hoursUntilAvailable (FR-055)", () => {
  it.each([1, 3_599])("says less than an hour for %i seconds", (seconds) => {
    expect(hoursUntilAvailable(seconds)).toEqual({ underHour: true });
  });

  it.each([
    [3_600, 1],
    [3_601, 2],
    [7_260, 3],
    [86_400, 24],
  ])("rounds %i seconds up to %i hours", (seconds, hours) => {
    expect(hoursUntilAvailable(seconds)).toEqual({ underHour: false, hours });
  });
});
