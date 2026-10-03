import { describe, expect, it } from "vitest";

import { KNOWN_DETAILS } from "@/lib/http/client/form-errors";
import en from "@/messages/en.json";
import { ERROR_CODES } from "@/server/errors";

// An error code must never reach the screen as a raw key.
const catalog = en as unknown as {
  errors?: {
    codes?: Record<string, string>;
    details?: Record<string, string>;
    unexpected?: string;
  };
};

describe("error-code catalog coverage", () => {
  it.each(ERROR_CODES)("has a message for %s", (code) => {
    expect(catalog.errors?.codes?.[code]).toBeTruthy();
  });

  it.each([...KNOWN_DETAILS])("has a message for the detail %s", (key) => {
    expect(catalog.errors?.details?.[key]).toBeTruthy();
  });

  it("has the generic unexpected-failure message", () => {
    expect(catalog.errors?.unexpected).toBeTruthy();
  });
});
