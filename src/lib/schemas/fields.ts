import { z } from "zod";

// Messages are catalog keys, translated where they render.

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "validation.email.invalid")
  .pipe(z.email("validation.email.invalid"));

const encoder = new TextEncoder();

// bcrypt ignores bytes past 72, so a longer password is refused, not truncated (R13).
export const password = z
  .string()
  .refine((value) => Array.from(value).length >= 12, {
    error: "validation.password.tooShort",
  })
  .refine((value) => encoder.encode(value).length <= 72, {
    error: "validation.password.tooLong",
  });

function personName(key: "firstName" | "lastName") {
  return z
    .string()
    .trim()
    .min(1, `validation.${key}.required`)
    .max(100, `validation.${key}.tooLong`);
}

export const firstName = personName("firstName");
export const lastName = personName("lastName");
