import type { z } from "zod";

import type { FieldErrors } from "@/server/errors";

type Translate = (key: string) => string;

/** Always a new object: Base UI Form re-syncs server errors only when the reference changes. */
export function toFormErrors(
  fields: FieldErrors | undefined,
  t: Translate,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [name, keys] of Object.entries(fields ?? {})) {
    if (keys[0]) errors[name] = t(keys[0]);
  }
  return errors;
}

/** Details with a message of their own; any other detail uses the code's. */
export const KNOWN_DETAILS = new Set([
  "email_in_use_deactivated",
  "invite_not_allowed_super_admin",
  "invite_not_allowed_deactivated",
]);

const CLIENT_ONLY_CODES = new Set(["network", "unexpected"]);

export function errorMessageKey(code: string, detail?: string): string {
  if (CLIENT_ONLY_CODES.has(code)) return "errors.unexpected";

  const detailed = `${code}_${detail}`;
  if (detail && KNOWN_DETAILS.has(detailed))
    return `errors.details.${detailed}`;

  return `errors.codes.${code}`;
}

/** A Base UI `Field.Root validate` that runs one zod rule and translates it. */
export function validateWith(schema: z.ZodType, t: Translate) {
  return (value: unknown): string | null => {
    const result = schema.safeParse(value);
    return result.success ? null : t(result.error.issues[0].message);
  };
}
