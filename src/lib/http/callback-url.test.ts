import { describe, expect, it } from "vitest";

import { safeCallbackUrl, signInUrlFor } from "@/lib/http/callback-url";

describe("safeCallbackUrl", () => {
  it("keeps a path inside the product, with its query", () => {
    expect(safeCallbackUrl("/uk/dashboard/users?x=1", "uk")).toBe(
      "/uk/dashboard/users?x=1",
    );
  });

  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["/.//evil.com"],
    ["/a/..//evil.com"],
    ["/%2e//evil.com"],
    ["/./\\evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["dashboard"],
    [""],
    [null],
    [undefined],
  ])("replaces %j with the protected home", (value) => {
    expect(safeCallbackUrl(value, "en")).toBe("/en/dashboard");
  });
});

describe("signInUrlFor", () => {
  it("points at the current locale's sign-in page and back to the current address", () => {
    expect(
      signInUrlFor({ pathname: "/uk/dashboard/users", search: "?x=1" }),
    ).toBe("/uk/sign-in?callbackUrl=%2Fuk%2Fdashboard%2Fusers%3Fx%3D1");
  });
});
