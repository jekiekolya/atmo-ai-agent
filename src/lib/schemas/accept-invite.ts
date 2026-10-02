import { z } from "zod";

import { confirmsPassword, password } from "@/lib/schemas/fields";

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, "validation.token.invalid"),
    password,
    confirmPassword: z.string(),
  })
  .refine(
    (value) => confirmsPassword.holds(value.confirmPassword, value.password),
    { path: ["confirmPassword"], error: confirmsPassword.error },
  );

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
