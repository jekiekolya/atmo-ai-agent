import { describe, expect, it } from "vitest";

import {
  BCRYPT_COST,
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";

describe("password hashing", () => {
  it("round-trips", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery!", hash)).toBe(false);
  });

  it("uses cost 12", async () => {
    expect(BCRYPT_COST).toBe(12);
    expect(await hashPassword("correct horse battery")).toMatch(
      /^\$2[aby]\$12\$/,
    );
  });

  it("has a dummy hash that is a real cost-12 bcrypt hash matching nothing plausible", async () => {
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$12\$.{53}$/);
    expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("password1234", DUMMY_HASH)).toBe(false);
  });
});
