import { describe, expect, it } from "vitest";

import {
  confirmsPassword,
  differsFromCurrent,
  email,
  firstName,
  lastName,
  password,
} from "@/lib/schemas/fields";

function messages(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.success
    ? []
    : result.error!.issues.map((issue) => issue.message);
}

describe("email", () => {
  it("trims and lowercases", () => {
    expect(email.parse("  Owner@Example.COM ")).toBe("owner@example.com");
  });

  it.each(["", "not-an-email", "a@", "@b.com"])("rejects %j", (value) => {
    expect(email.safeParse(value).success).toBe(false);
  });

  it("rejects addresses longer than 254 characters", () => {
    const long = `${"a".repeat(250)}@b.co`;
    expect(email.safeParse(long).success).toBe(false);
  });

  it("reports catalog keys, not English", () => {
    expect(messages(email.safeParse("nope"))).toEqual([
      "validation.email.invalid",
    ]);
  });
});

describe("password (FR-040)", () => {
  it("rejects 11 characters and accepts 12", () => {
    expect(messages(password.safeParse("a".repeat(11)))).toEqual([
      "validation.password.tooShort",
    ]);
    expect(password.safeParse("a".repeat(12)).success).toBe(true);
  });

  it("counts an emoji as one character", () => {
    // 11 emoji are 44 bytes but 11 characters: still too short.
    expect(password.safeParse("🔒".repeat(11)).success).toBe(false);
    expect(password.safeParse("🔒".repeat(12)).success).toBe(true);
  });

  it("accepts exactly 72 bytes and rejects 73", () => {
    expect(password.safeParse("a".repeat(72)).success).toBe(true);
    expect(messages(password.safeParse("a".repeat(73)))).toEqual([
      "validation.password.tooLong",
    ]);
  });

  it("measures bytes, not characters", () => {
    // 37 Cyrillic letters are 74 bytes: too long despite being 37 characters.
    expect(password.safeParse("ж".repeat(37)).success).toBe(false);
    expect(password.safeParse("ж".repeat(36)).success).toBe(true);
  });

  it("does not trim", () => {
    expect(password.parse(`  ${"a".repeat(12)}  `)).toBe(
      `  ${"a".repeat(12)}  `,
    );
  });
});

describe.each([
  ["firstName", firstName],
  ["lastName", lastName],
] as const)("%s (FR-074)", (key, schema) => {
  it("trims", () => {
    expect(schema.parse("  Olena ")).toBe("Olena");
  });

  it("requires at least one character after trimming", () => {
    expect(messages(schema.safeParse("   "))).toEqual([
      `validation.${key}.required`,
    ]);
  });

  it("allows up to 100 characters", () => {
    expect(schema.safeParse("a".repeat(100)).success).toBe(true);
    expect(messages(schema.safeParse("a".repeat(101)))).toEqual([
      `validation.${key}.tooLong`,
    ]);
  });
});

describe("confirmsPassword", () => {
  it("holds only when the confirmation repeats the password exactly", () => {
    expect(confirmsPassword.holds("a password", "a password")).toBe(true);
    expect(confirmsPassword.holds("a password", "A password")).toBe(false);
    expect(confirmsPassword.error).toBe("validation.confirmPassword.mismatch");
  });
});

describe("differsFromCurrent", () => {
  it("holds only when the new password is not the current one", () => {
    expect(differsFromCurrent.holds("new one", "old one")).toBe(true);
    expect(differsFromCurrent.holds("same", "same")).toBe(false);
    expect(differsFromCurrent.error).toBe(
      "validation.newPassword.sameAsCurrent",
    );
  });
});
