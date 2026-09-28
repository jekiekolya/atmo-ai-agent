"use client";

import { Form } from "@base-ui/react/form";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SubmitButton } from "@/components/submit-button/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/api-client";
import {
  routeFailure,
  toFormErrors,
  validateWith,
} from "@/lib/http/form-errors";
import { hardNavigate } from "@/lib/http/hard-navigate";
import { changePasswordSchema } from "@/lib/schemas/change-password";
import { password as passwordRule } from "@/lib/schemas/fields";

export function ChangePasswordForm() {
  const t = useTranslations("account");
  const translateKey = useTranslateKey();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  // Password fields are cleared after any failure by remounting them.
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setAlert(null);

    const result = await apiRequest("PUT", "/api/account/password", {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      confirmPassword: values.confirmPassword,
    });

    if (result.ok) {
      // Signed out everywhere, this device included (FR-057).
      hardNavigate(`/${locale}/sign-in?notice=password-changed`);
      return;
    }

    setPending(false);
    setAttempt((n) => n + 1);
    const route = routeFailure(result, { account_locked: "account.locked" });
    if (route.kind === "fields") {
      setErrors(toFormErrors(route.fields, translateKey));
    } else if (route.kind === "alert") {
      setAlert(translateKey(route.key));
    } else {
      toast.add({ title: translateKey("errors.unexpected"), type: "error" });
    }
  }

  const shape = changePasswordSchema.shape;

  return (
    <Form
      key={attempt}
      method="post"
      className="flex flex-col gap-5"
      errors={errors}
      onFormSubmit={submit}
    >
      {alert && (
        <Alert variant="destructive">
          <AlertDescription>{alert}</AlertDescription>
        </Alert>
      )}

      <Field
        name="currentPassword"
        validate={validateWith(shape.currentPassword, translateKey)}
      >
        <FieldLabel>{t("currentPassword")}</FieldLabel>
        <Input type="password" autoComplete="current-password" />
        <FieldError />
      </Field>

      <Field
        name="newPassword"
        validate={(value, values) =>
          validateWith(passwordRule, translateKey)(value) ??
          (value === values.currentPassword
            ? translateKey("validation.newPassword.sameAsCurrent")
            : null)
        }
      >
        <FieldLabel>{t("newPassword")}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldDescription>{t("newPasswordHint")}</FieldDescription>
        <FieldError />
      </Field>

      <Field
        name="confirmPassword"
        validate={(value, values) =>
          value === values.newPassword
            ? null
            : translateKey("validation.confirmPassword.mismatch")
        }
      >
        <FieldLabel>{t("confirmPassword")}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldError />
      </Field>

      <SubmitButton pending={pending} pendingLabel={t("pending")}>
        {t("submit")}
      </SubmitButton>
    </Form>
  );
}
