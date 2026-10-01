import type { JWT } from "next-auth/jwt";

import {
  evaluateSession,
  type SessionPolicy,
} from "@/server/auth/session-policy";
import type { User } from "@/server/users/user-repository";

type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "role"
  | "isActive"
  | "passwordChangedAt"
  | "signedOutAt"
>;

export type JwtCallbackDeps = {
  findUser: (id: string) => Promise<SessionUser | null>;
  now: () => Date;
  policy: SessionPolicy;
};

type Params = {
  token: JWT;
  user?: { id?: string } | null;
  trigger?: "signIn" | "signUp" | "update";
};

// null rejects the session; the cookie is cleared only where next-auth forwards Set-Cookie.
export async function jwtCallback(
  { token, user, trigger }: Params,
  deps: JwtCallbackDeps,
): Promise<JWT | null> {
  if (trigger === "signIn" && user?.id) {
    token = { ...token, sub: user.id, authTime: deps.now().getTime() };
  }

  if (!token.sub || typeof token.authTime !== "number") return null;

  const stored = await deps.findUser(token.sub);
  const identity = evaluateSession(
    { authTime: token.authTime },
    stored,
    deps.now(),
    deps.policy,
  );

  return identity === null ? null : { ...token, ...identity };
}
