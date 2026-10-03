"use client";

import { Form } from "@base-ui/react/form";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { FormAlert } from "@/components/form-kit/form-alert/form-alert";
import { useFormFailure } from "@/components/form-kit/form-alert/use-form-failure";
import { NewPasswordFields } from "@/components/account/new-password-fields/new-password-fields";
import { SubmitButton } from "@/components/form-kit/submit-button/submit-button";
import { apiRequest } from "@/lib/http/api-client";
import { hardNavigate } from "@/lib/http/hard-navigate";
import { API_ROUTES, PAGES } from "@/lib/routes";

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const failure = useFormFailure();
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    failure.clearAlert();

    const result = await apiRequest("POST", API_ROUTES.acceptInvite, {
      token,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (result.ok) {
      hardNavigate(`/${locale}${PAGES.signIn}?notice=password-set`);
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
