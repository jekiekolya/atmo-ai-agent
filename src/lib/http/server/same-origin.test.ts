import { describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/http/server/same-origin";

function request(headers: Record<string, string>) {
  return new Request("http://internal:3000/api/users", {
    method: "POST",
    headers,
  });
}

describe("isSameOrigin", () => {
  it("accepts an Origin matching the Host", () => {
    expect(
      isSameOrigin(
        request({ origin: "https://atmo.example", host: "atmo.example" }),
      ),
    ).toBe(true);
  });

  it("prefers X-Forwarded-Host over Host", () => {
    expect(
      isSameOrigin(
        request({
          origin: "https://atmo.example",
          host: "internal:3000",
          "x-forwarded-host": "atmo.example",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a foreign Origin", () => {
    expect(
      isSameOrigin(
        request({ origin: "https://evil.example", host: "atmo.example" }),
      ),
    ).toBe(false);
  });

  it('rejects the literal "null" Origin', () => {
    expect(
      isSameOrigin(request({ origin: "null", host: "atmo.example" })),
    ).toBe(false);
  });

  it("falls back to Sec-Fetch-Site when Origin is absent", () => {
    expect(
      isSameOrigin(
        request({ host: "atmo.example", "sec-fetch-site": "same-origin" }),
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        request({ host: "atmo.example", "sec-fetch-site": "cross-site" }),
      ),
    ).toBe(false);
  });

  it("rejects a request carrying neither header", () => {
    expect(isSameOrigin(request({ host: "atmo.example" }))).toBe(false);
  });
});
