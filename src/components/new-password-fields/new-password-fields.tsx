"use client";

import type { ReactNode } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { validatePair, validateWith } from "@/lib/http/form-errors";
import {
  confirmsPassword,
  differsFromCurrent,
  password,
} from "@/lib/schemas/fields";

/** A new password and its confirmation, which is always named `confirmPassword`. */
export function NewPasswordFields({
  name,
  label,
  hint,
  confirmLabel,
  currentPasswordName,
}: {
  name: string;
  label: ReactNode;
  hint: ReactNode;
  confirmLabel: ReactNode;
  currentPasswordName?: string;
}) {
  const translateKey = useTranslateKey();
  const passwordRule = validateWith(password, translateKey);
  const differs =
    currentPasswordName === undefined
      ? null
      : validatePair(differsFromCurrent, currentPasswordName, translateKey);

  return (
    <>
      <Field
        name={name}
        validate={(value, values) =>
          passwordRule(value) ?? differs?.(value, values) ?? null
        }
      >
        <FieldLabel>{label}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldDescription>{hint}</FieldDescription>
        <FieldError />
      </Field>

      <Field
        name="confirmPassword"
        validate={validatePair(confirmsPassword, name, translateKey)}
      >
        <FieldLabel>{confirmLabel}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldError />
      </Field>
    </>
  );
}
