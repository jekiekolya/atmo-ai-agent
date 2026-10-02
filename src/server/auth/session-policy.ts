import type { User } from "@generated/client";

export type SessionClaims = {
  /** When the sign-in that created the session happened, in milliseconds. */
  authTime: number;
};

export type SessionPolicy = { absoluteLifetimeMs: number };

export type SessionIdentity = Pick<
  User,
  "role" | "firstName" | "lastName" | "email"
>;

export type StoredSessionUser = SessionIdentity &
  Pick<User, "isActive" | "passwordChangedAt" | "signedOutAt">;

export function identityOf(user: SessionIdentity): SessionIdentity {
  return {
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
}

/** null rejects; the rolling expiry is enforced earlier, by the cookie itself. */
export function evaluateSession(
  claims: SessionClaims,
  user: StoredSessionUser | null,
  now: Date,
  policy: SessionPolicy,
): SessionIdentity | null {
  if (user === null || !user.isActive) return null;

  const issuedBefore = (moment: Date | null) =>
    moment !== null && moment.getTime() > claims.authTime;

  if (issuedBefore(user.passwordChangedAt)) return null;
  if (issuedBefore(user.signedOutAt)) return null;
  if (now.getTime() - claims.authTime > policy.absoluteLifetimeMs) return null;

  return identityOf(user);
}
