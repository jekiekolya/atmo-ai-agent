import type { Role, User } from "@generated/client";

export type SessionClaims = {
  /** When the sign-in that created the session happened, in milliseconds. */
  authTime: number;
};

export type SessionPolicy = { absoluteLifetimeMs: number };

export type SessionIdentity = {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
};

type SessionUser = Pick<
  User,
  | "isActive"
  | "role"
  | "firstName"
  | "lastName"
  | "email"
  | "passwordChangedAt"
  | "signedOutAt"
>;

/** null rejects; the rolling expiry is enforced earlier, by the cookie itself. */
export function evaluateSession(
  claims: SessionClaims,
  user: SessionUser | null,
  now: Date,
  policy: SessionPolicy,
): SessionIdentity | null {
  if (user === null || !user.isActive) return null;

  const issuedBefore = (moment: Date | null) =>
    moment !== null && moment.getTime() > claims.authTime;

  if (issuedBefore(user.passwordChangedAt)) return null;
  if (issuedBefore(user.signedOutAt)) return null;
  if (now.getTime() - claims.authTime > policy.absoluteLifetimeMs) return null;

  return {
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
}
