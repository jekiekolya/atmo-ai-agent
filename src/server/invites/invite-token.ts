import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 256 random bits. Shown to the super admin once and never stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

// SHA-256, not bcrypt: a 256-bit random token cannot be guessed and must be found by its hash.
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
