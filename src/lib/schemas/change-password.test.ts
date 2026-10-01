import { describe, expect, it } from "vitest";

import { changePasswordSchema } from "@/lib/schemas/change-password";

const valid = {
  currentPassword: "the old password",
  newPassword: "a brand new password",
  confirmPassword: "a brand new password",
};

const issues = (input: unknown) => {
  const result = changePasswordSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => [i.path[0], i.message]);
};

describe("changePasswordSchema (FR-056)", () => {
  it("accepts a valid change", () => {
    expect(issues(valid)).toEqual([]);
  });

  it("applies the password rules to the new password", () => {
    const short = "a".repeat(11);
    expect(
      issues({ ...valid, newPassword: short, confirmPassword: short }),
    ).toEqual([["newPassword", "validation.password.tooShort"]]);
  });

  it("reports a mismatch on confirmPassword", () => {
    expect(issues({ ...valid, confirmPassword: "something else" })).toEqual([
      ["confirmPassword", "validation.confirmPassword.mismatch"],
    ]);
  });

  it("refuses a new password equal to the current one", () => {
    const same = "the old password";
    expect(
      issues({ ...valid, newPassword: same, confirmPassword: same }),
    ).toEqual([["newPassword", "validation.newPassword.sameAsCurrent"]]);
  });

  it("requires the current password", () => {
    expect(issues({ ...valid, currentPassword: "" })).toEqual([
      ["currentPassword", "validation.password.required"],
    ]);
  });
});
