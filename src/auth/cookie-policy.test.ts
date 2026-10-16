import { describe, expect, it } from "vitest";

import { secureCookiesFor } from "@/auth/cookie-policy";

describe("secureCookiesFor", () => {
  it("drops the Secure flag on local, which serves plain http", () => {
    expect(secureCookiesFor({ appEnv: "local" })).toBe(false);
  });

  it.each(["dev", "staging", "production"] as const)(
    "sets the Secure flag on %s",
    (appEnv) => {
      expect(secureCookiesFor({ appEnv })).toBe(true);
    },
  );
});
