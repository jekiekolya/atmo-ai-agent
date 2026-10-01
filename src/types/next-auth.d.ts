import type { DefaultSession } from "next-auth";

import type { SessionUser } from "@/auth/dal";
import type { Role } from "@generated/client";

declare module "next-auth" {
  interface User {
    role?: Role;
    firstName?: string;
    lastName?: string;
  }

  interface Session {
    user: SessionUser & DefaultSession["user"];
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
