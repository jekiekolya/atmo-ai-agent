import { describe, expect, it } from "vitest";

import { signInSchema } from "@/lib/schemas/sign-in";

describe("signInSchema", () => {
  it("normalizes the email", () => {
    expect(signInSchema.parse({ email: " A@B.co ", password: "x" }).email).toBe(
      "a@b.co",
    );
  });

  it("only requires a non-empty password — the rules are never revealed at sign-in", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.co", password: "x" }).success,
    ).toBe(true);
    expect(
      signInSchema.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(signInSchema.safeParse({}).success).toBe(false);
  });
});
