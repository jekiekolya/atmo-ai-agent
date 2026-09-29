"use client";

import { Form } from "@base-ui/react/form";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InviteLinkDialog,
  type ShownInvite,
} from "@/components/invite-link-dialog/invite-link-dialog";
import { SubmitButton } from "@/components/submit-button/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { toast } from "@/components/ui/toast";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/api-client";
import {
  routeFailure,
  toFormErrors,
  validateWith,
} from "@/lib/http/form-errors";
import { createUserSchema } from "@/lib/schemas/create-user";

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
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [shown, setShown] = useState<ShownInvite | null>(null);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setAlert(null);

    const result = await apiRequest<Created>("POST", "/api/users", {
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

    const route = routeFailure(result);
    if (route.kind === "fields") {
      setErrors(toFormErrors(route.fields, translateKey));
    } else if (route.kind === "alert") {
      setAlert(translateKey(route.key));
    } else {
      toast.add({ title: translateKey(route.key), type: "error" });
    }
  }

  const shape = createUserSchema.shape;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setErrors({});
            setAlert(null);
          }
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
            errors={errors}
            onFormSubmit={submit}
          >
            {alert && (
              <Alert variant="destructive">
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            )}
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
