"use client";

import type { Field as FieldPrimitive } from "@base-ui/react/field";
import { type ReactNode, useRef } from "react";

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
  const confirm = useRef<FieldPrimitive.Root.Actions>(null);
  // Base UI re-checks a field only on its own change; once the confirmation has been checked, keep it current.
  const confirmChecked = useRef(false);
  const matches = validatePair(confirmsPassword, name, translateKey);
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
        <Input
          type="password"
          autoComplete="new-password"
          onChange={() => {
            if (confirmChecked.current) confirm.current?.validate();
          }}
        />
        <FieldDescription>{hint}</FieldDescription>
        <FieldError />
      </Field>

      <Field
        name="confirmPassword"
        actionsRef={confirm}
        validate={(value, values) => {
          confirmChecked.current = true;
          return matches(value, values);
        }}
      >
        <FieldLabel>{confirmLabel}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldError />
      </Field>
    </>
  );
}
