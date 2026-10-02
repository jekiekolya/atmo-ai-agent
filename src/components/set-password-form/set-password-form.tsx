"use client";

import { Form } from "@base-ui/react/form";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { FormAlert } from "@/components/form-alert/form-alert";
import { useFormFailure } from "@/components/form-alert/use-form-failure";
import { NewPasswordFields } from "@/components/new-password-fields/new-password-fields";
import { SubmitButton } from "@/components/submit-button/submit-button";
import { apiRequest } from "@/lib/http/api-client";
import { hardNavigate } from "@/lib/http/hard-navigate";

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const failure = useFormFailure();
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    failure.clearAlert();

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
    failure.show(result);
  }

  return (
    <Form
      method="post"
      className="flex flex-col gap-5"
      errors={failure.errors}
      onFormSubmit={submit}
    >
      <FormAlert message={failure.alert} />

      <NewPasswordFields
        key={attempt}
        name="password"
        label={t("password")}
        hint={t("passwordHint")}
        confirmLabel={t("confirmPassword")}
      />

      <SubmitButton pending={pending} pendingLabel={t("pending")}>
        {t("submit")}
      </SubmitButton>
    </Form>
  );
}
