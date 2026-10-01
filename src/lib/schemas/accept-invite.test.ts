import { describe, expect, it } from "vitest";

import { acceptInviteSchema } from "@/lib/schemas/accept-invite";

const valid = {
  token: "t",
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
};

describe("acceptInviteSchema (FR-040, FR-044)", () => {
  it("accepts matching passwords that follow the rules", () => {
    expect(acceptInviteSchema.safeParse(valid).success).toBe(true);
  });

  it("reports a mismatch on confirmPassword", () => {
    const result = acceptInviteSchema.safeParse({
      ...valid,
      confirmPassword: "something else",
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues).toEqual([
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "validation.confirmPassword.mismatch",
      }),
    ]);
  });

  it("inherits the password rules", () => {
    const short = "a".repeat(11);
    const result = acceptInviteSchema.safeParse({
      ...valid,
      password: short,
      confirmPassword: short,
    });

    expect(result.error!.issues[0]).toMatchObject({
      path: ["password"],
      message: "validation.password.tooShort",
    });
  });

  it("requires a token", () => {
    expect(acceptInviteSchema.safeParse({ ...valid, token: "" }).success).toBe(
      false,
    );
  });
});
