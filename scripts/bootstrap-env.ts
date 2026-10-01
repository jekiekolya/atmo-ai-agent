import { z } from "zod";

import { email, firstName, lastName, password } from "@/lib/schemas/fields";
import en from "@/messages/en.json";
import type { BootstrapInput } from "@/server/users/user-service";

function englishFor(key: string): string {
  const text = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    );
  return typeof text === "string" ? text : key;
}

const schema = z.object({
  BOOTSTRAP_SUPER_ADMIN_EMAIL: email,
  BOOTSTRAP_SUPER_ADMIN_FIRST_NAME: firstName,
  BOOTSTRAP_SUPER_ADMIN_LAST_NAME: lastName,
  BOOTSTRAP_SUPER_ADMIN_PASSWORD: password,
});

export function parseBootstrapEnv(
  env: Record<string, string | undefined>,
):
  | { success: true; data: BootstrapInput }
  | { success: false; errors: string[] } {
  const parsed = schema.safeParse(env);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => {
        const name = issue.path.join(".");
        const problem =
          env[name] === undefined ? "not set" : englishFor(issue.message);
        return `  ${name}: ${problem}`;
      }),
    };
  }

  return {
    success: true,
    data: {
      email: parsed.data.BOOTSTRAP_SUPER_ADMIN_EMAIL,
      firstName: parsed.data.BOOTSTRAP_SUPER_ADMIN_FIRST_NAME,
      lastName: parsed.data.BOOTSTRAP_SUPER_ADMIN_LAST_NAME,
      password: parsed.data.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
    },
  };
}
