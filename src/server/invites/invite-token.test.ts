import { describe, expect, it } from "vitest";

import {
  generateInviteToken,
  hashInviteToken,
  isWellFormedToken,
} from "@/server/invites/invite-token";

describe("invite tokens (FR-041, research R12)", () => {
  it("are 32 random bytes as 43 base64url characters, different every time", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();

    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("are fingerprinted with a deterministic sha256", () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(token);
  });

  it.each(["", "short", "a".repeat(44), `${"a".repeat(42)}!`])(
    "reject a malformed token %j",
    (value) => {
      expect(isWellFormedToken(value)).toBe(false);
    },
  );

  it("accept a generated token", () => {
    expect(isWellFormedToken(generateInviteToken())).toBe(true);
  });
});
