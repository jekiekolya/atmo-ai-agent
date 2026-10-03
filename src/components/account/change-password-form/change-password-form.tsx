"use client";

import { Form } from "@base-ui/react/form";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { FormAlert } from "@/components/form-kit/form-alert/form-alert";
import { useFormFailure } from "@/components/form-kit/form-alert/use-form-failure";
import { NewPasswordFields } from "@/components/account/new-password-fields/new-password-fields";
import { SubmitButton } from "@/components/form-kit/submit-button/submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/api-client";
import { validateWith } from "@/lib/http/form-errors";
import { hardNavigate } from "@/lib/http/hard-navigate";
import { API_ROUTES, PAGES } from "@/lib/routes";
import { changePasswordSchema } from "@/lib/schemas/change-password";

export function ChangePasswordForm() {
  const t = useTranslations("account");
  const translateKey = useTranslateKey();
  const locale = useLocale();
  const failure = useFormFailure();
  const [pending, setPending] = useState(false);
  // Password fields are cleared after any failure by remounting them.
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    failure.clearAlert();

    const result = await apiRequest("PUT", API_ROUTES.password, {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      confirmPassword: values.confirmPassword,
    });

    if (result.ok) {
      // Signed out everywhere, this device included (FR-057).
      hardNavigate(`/${locale}${PAGES.signIn}?notice=password-changed`);
      return;
    }

    setPending(false);
    setAttempt((n) => n + 1);
    failure.show(result, { account_locked: "account.locked" });
  }

  return (
    <Form
      method="post"
      className="flex flex-col gap-5"
      errors={failure.errors}
      onFormSubmit={submit}
    >
      <FormAlert message={failure.alert} />

      <Field
        key={`current-${attempt}`}
        name="currentPassword"
        validate={validateWith(
          changePasswordSchema.shape.currentPassword,
          translateKey,
        )}
      >
        <FieldLabel>{t("currentPassword")}</FieldLabel>
        <Input type="password" autoComplete="current-password" />
        <FieldError />
      </Field>

      <NewPasswordFields
        key={`new-${attempt}`}
        name="newPassword"
        currentPasswordName="currentPassword"
        label={t("newPassword")}
        hint={t("newPasswordHint")}
        confirmLabel={t("confirmPassword")}
      />

      <SubmitButton pending={pending} pendingLabel={t("pending")}>
        {t("submit")}
      </SubmitButton>
    </Form>
  );
}
