"use client";

import { Form } from "@base-ui/react/form";
import { signIn, type SignInResponse } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { validateWith } from "@/lib/http/form-errors";
import { hardNavigate } from "@/lib/http/hard-navigate";
import { signInSchema } from "@/lib/schemas/sign-in";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("auth.signIn");
  const translateKey = useTranslateKey();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Remounting the password field is how it is cleared after a failure.
  const [attempt, setAttempt] = useState(0);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setFailed(false);

    // Typed as always resolving, but it returns undefined when next-auth's providers fetch fails.
    let result: SignInResponse | undefined;
    try {
      result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
      });
    } catch {
      result = undefined;
    }

    if (result && !result.error) {
      hardNavigate(callbackUrl);
      return;
    }

    setPending(false);
    setAttempt((n) => n + 1);
    // A failed sign-in still answers ok: true; only error tells (research R7).
    if (result?.error === "CredentialsSignin") {
      setFailed(true);
    } else {
      toast.add({ title: translateKey("errors.unexpected"), type: "error" });
    }
  }

  return (
    <Form method="post" className="flex flex-col gap-5" onFormSubmit={submit}>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{t("failed")}</AlertDescription>
        </Alert>
      )}

      <Field
        name="email"
        validate={validateWith(signInSchema.shape.email, translateKey)}
      >
        <FieldLabel>{t("email")}</FieldLabel>
        {/* Not type="email": its native message is in the browser's language (R14). */}
        <Input
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
        <FieldError />
      </Field>

      <Field
        key={attempt}
        name="password"
        validate={validateWith(signInSchema.shape.password, translateKey)}
      >
        <FieldLabel>{t("password")}</FieldLabel>
        <Input type="password" autoComplete="current-password" />
        <FieldError />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" aria-hidden />}
        {pending ? t("pending") : t("submit")}
      </Button>
    </Form>
  );
}
