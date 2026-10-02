import { z } from "zod";

import {
  confirmsPassword,
  differsFromCurrent,
  password,
} from "@/lib/schemas/fields";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.password.required"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine(
    (value) => confirmsPassword.holds(value.confirmPassword, value.newPassword),
    { path: ["confirmPassword"], error: confirmsPassword.error },
  )
  .refine(
    (value) =>
      differsFromCurrent.holds(value.newPassword, value.currentPassword),
    { path: ["newPassword"], error: differsFromCurrent.error },
  );

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
