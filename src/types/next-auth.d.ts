import type { DefaultSession } from "next-auth";

import type { Role } from "@generated/client";

declare module "next-auth" {
  interface User {
    role?: Role;
    firstName?: string;
    lastName?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      firstName: string;
      lastName: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** When the sign-in that created this session happened, in milliseconds. */
    authTime?: number;
    role?: Role;
    firstName?: string;
    lastName?: string;
  }
}
