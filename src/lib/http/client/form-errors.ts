import type { z } from "zod";

import type { PairRule } from "@/lib/schemas/fields";
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

const TOAST_CODES = new Set([...CLIENT_ONLY_CODES, "forbidden_origin"]);

export type FailureRoute =
  | { kind: "fields"; fields: FieldErrors; alertKey?: string }
  | { kind: "alert"; key: string }
  | { kind: "toast"; key: string };

/** Where a failed request's message belongs; `messages` overrides the key for a code. */
export function routeFailure(
  failure: { code: string; detail?: string; fields?: FieldErrors },
  messages: Partial<Record<string, string>> = {},
): FailureRoute {
  if (failure.fields) {
    // `_form` is the whole form's error, which no field renders (FR-068).
    const { _form, ...fields } = failure.fields;
    return { kind: "fields", fields, alertKey: _form?.[0] };
  }
  const key =
    messages[failure.code] ?? errorMessageKey(failure.code, failure.detail);
  return { kind: TOAST_CODES.has(failure.code) ? "toast" : "alert", key };
}

/** A Base UI `Field.Root validate` that runs one zod rule and translates it. */
export function validateWith(schema: z.ZodType, t: Translate) {
  return (value: unknown): string | null => {
    const result = schema.safeParse(value);
    return result.success ? null : t(result.error.issues[0].message);
  };
}

/** A Base UI `Field.Root validate` that checks a pair rule against another field's value. */
export function validatePair(rule: PairRule, other: string, t: Translate) {
  return (value: unknown, values: Record<string, unknown>): string | null =>
    rule.holds(value, values[other]) ? null : t(rule.error);
}
