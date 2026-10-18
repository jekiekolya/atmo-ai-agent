"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/http/client/api-client";
import { hardNavigate } from "@/lib/http/client/hard-navigate";
import { API_ROUTES } from "@/lib/routes";

export function InviteSignOut() {
  const t = useTranslations();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await apiRequest("POST", API_ROUTES.signOut);

    if (result.ok) {
      hardNavigate(window.location.pathname);
      return;
    }

    setPending(false);
    toast.add({ title: t("errors.unexpected"), type: "error" });
  }

  return (
    <Button disabled={pending} onClick={signOut}>
      {pending && <Spinner aria-hidden />}
      {pending ? t("shell.signingOut") : t("shell.signOut")}
    </Button>
  );
}
