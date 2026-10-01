import { z } from "zod";

import { email, firstName, lastName } from "@/lib/schemas/fields";

export const createUserSchema = z.object({
  email,
  firstName,
  lastName,
  // Only ADMIN is assignable: the one super admin already exists (FR-002, FR-048).
  role: z.enum(["ADMIN"], "validation.role.notAssignable"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
