import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { secureCookiesFor } from "@/auth/cookie-policy";
import { jwtCallback } from "@/auth/jwt-callback";
import { config } from "@/config";
import { signInSchema } from "@/lib/schemas/sign-in";
import { authenticate } from "@/server/auth/authenticate";
import { findUserById } from "@/server/users/user-repository";

// next-auth still reads AUTH_URL / NEXTAUTH_URL itself when set, so they must stay unset (R9).
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: config.authSecret,
  trustHost: true,
  basePath: "/api/auth",
  useSecureCookies: secureCookiesFor(config),
  session: { strategy: "jwt", maxAge: config.sessionMaxAgeSeconds },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await authenticate(
          parsed.data.email,
          parsed.data.password,
        );
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],
  callbacks: {
    jwt: (params) =>
      jwtCallback(params, {
        findUser: findUserById,
        now: () => new Date(),
        policy: {
          absoluteLifetimeMs: config.sessionAbsoluteLifetimeSeconds * 1000,
        },
      }),
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          email: token.email ?? "",
          role: token.role ?? "ADMIN",
          firstName: token.firstName ?? "",
          lastName: token.lastName ?? "",
        },
      };
    },
  },
});
