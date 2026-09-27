import { z } from "zod";

import { email } from "@/lib/schemas/fields";

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "validation.password.required"),
});

export type SignInInput = z.infer<typeof signInSchema>;
