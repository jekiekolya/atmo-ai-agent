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
import { password as passwordRule } from "@/lib/schemas/fields";

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const translateKey = useTranslateKey();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setAlert(null);

    const result = await apiRequest("POST", "/api/invites/accept", {
      token,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (result.ok) {
      hardNavigate(`/${locale}/sign-in?notice=password-set`);
      return;
    }

    setPending(false);
    setAttempt((n) => n + 1);
    const route = routeFailure(result);
    if (route.kind === "fields") {
      setErrors(toFormErrors(route.fields, translateKey));
    } else if (route.kind === "alert") {
      setAlert(translateKey(route.key));
    } else {
      toast.add({ title: translateKey(route.key), type: "error" });
    }
  }

  return (
    <Form
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
        key={`password-${attempt}`}
        name="password"
        validate={validateWith(passwordRule, translateKey)}
      >
        <FieldLabel>{t("password")}</FieldLabel>
        <Input type="password" autoComplete="new-password" />
        <FieldDescription>{t("passwordHint")}</FieldDescription>
        <FieldError />
      </Field>

      <Field
        key={`confirm-${attempt}`}
        name="confirmPassword"
        validate={(value, values) =>
          value === values.password
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
