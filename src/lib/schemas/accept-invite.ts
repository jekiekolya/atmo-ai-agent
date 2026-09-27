import { z } from "zod";

import { password } from "@/lib/schemas/fields";

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, "validation.token.invalid"),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.confirmPassword === value.password, {
    path: ["confirmPassword"],
    error: "validation.confirmPassword.mismatch",
  });

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
