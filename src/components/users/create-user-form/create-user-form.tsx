"use client";

import { Form } from "@base-ui/react/form";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormAlert } from "@/components/form-kit/form-alert/form-alert";
import { useFormFailure } from "@/components/form-kit/form-alert/use-form-failure";
import {
  InviteLinkDialog,
  type ShownInvite,
} from "@/components/users/invite-link-dialog/invite-link-dialog";
import { SubmitButton } from "@/components/form-kit/submit-button/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/api-client";
import { validateWith } from "@/lib/http/form-errors";
import { createUserSchema } from "@/lib/schemas/create-user";
import { API_ROUTES } from "@/lib/routes";

type Created = {
  user: { firstName: string; lastName: string };
  invite: { path: string; expiresAt: string };
};

const ASSIGNABLE_ROLES = ["ADMIN"] as const;

export function CreateUserForm() {
  const t = useTranslations();
  const translateKey = useTranslateKey();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const failure = useFormFailure();
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState<ShownInvite | null>(null);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    failure.clearAlert();

    const result = await apiRequest<Created>("POST", API_ROUTES.users, {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      role: values.role,
    });
    setPending(false);

    if (result.ok) {
      setOpen(false);
      setShown({
        ...result.data.invite,
        name: t("common.fullName", result.data.user),
      });
      router.refresh();
      return;
    }

    failure.show(result);
  }

  const shape = createUserSchema.shape;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) failure.clear();
        }}
      >
        <DialogTrigger render={<Button />}>
          {t("users.create.open")}
        </DialogTrigger>
        <DialogContent closeLabel={t("dialog.close")}>
          <DialogHeader>
            <DialogTitle>{t("users.create.title")}</DialogTitle>
            <DialogDescription>
              {t("users.create.description")}
            </DialogDescription>
          </DialogHeader>
          <Form
            method="post"
            className="flex flex-col gap-4"
            errors={failure.errors}
            onFormSubmit={submit}
          >
            <FormAlert message={failure.alert} />
            <Field
              name="email"
              validate={validateWith(shape.email, translateKey)}
            >
              <FieldLabel>{t("users.create.email")}</FieldLabel>
              <Input
                type="text"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <FieldError />
            </Field>
            <Field
              name="firstName"
              validate={validateWith(shape.firstName, translateKey)}
            >
              <FieldLabel>{t("users.create.firstName")}</FieldLabel>
              <Input autoComplete="off" />
              <FieldError />
            </Field>
            <Field
              name="lastName"
              validate={validateWith(shape.lastName, translateKey)}
            >
              <FieldLabel>{t("users.create.lastName")}</FieldLabel>
              <Input autoComplete="off" />
              <FieldError />
            </Field>
            <Field name="role">
              <FieldLabel>{t("users.create.role")}</FieldLabel>
              <Select name="role" defaultValue="ADMIN">
                <SelectTrigger>
                  <SelectValue>
                    {(value: string | null) =>
                      value ? t(`users.roles.${value as "ADMIN"}`) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`users.roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
            <SubmitButton
              pending={pending}
              pendingLabel={t("users.create.pending")}
            >
              {t("users.create.submit")}
            </SubmitButton>
          </Form>
        </DialogContent>
      </Dialog>
      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </>
  );
}
