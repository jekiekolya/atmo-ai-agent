"use client";

import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/http/api-client";
import { hardNavigate } from "@/lib/http/hard-navigate";

export function AccountMenu({ name }: { name: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await apiRequest("POST", "/api/session/sign-out");

    // A full load, so Back cannot restore a cached protected page (FR-067).
    if (result.ok) {
      hardNavigate(`/${locale}/sign-in`);
      return;
    }

    setPending(false);
    toast.add({ title: t("errors.unexpected"), type: "error" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" />}
        aria-label={t("shell.accountMenu", { name })}
      >
        <span className="max-w-48 truncate">{name}</span>
        <ChevronDownIcon data-icon="inline-end" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="max-w-64 truncate">
            {t("shell.signedInAs", { name })}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnClick={false}
          disabled={pending}
          onClick={signOut}
        >
          {pending && <Spinner aria-hidden />}
          {pending ? t("shell.signingOut") : t("shell.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
