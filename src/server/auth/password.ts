import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

// Matches nothing; comparing against it keeps every failed sign-in equally slow (FR-015).
export const DUMMY_HASH =
  "$2b$12$Xgc7bX07OH2IaUyVbu1Nw.yjqv5gHXzmczjjuDYnEb1pQyXa3r62u";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
