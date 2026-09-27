import { z } from "zod";

import { password } from "@/lib/schemas/fields";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.password.required"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.confirmPassword === value.newPassword, {
    path: ["confirmPassword"],
    error: "validation.confirmPassword.mismatch",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    error: "validation.newPassword.sameAsCurrent",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
