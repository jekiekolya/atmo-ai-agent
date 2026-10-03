"use client";

import { EllipsisIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InviteLinkDialog,
  type ShownInvite,
} from "@/components/users/invite-link-dialog/invite-link-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/client/api-client";
import { errorMessageKey } from "@/lib/http/client/form-errors";
import { API_ROUTES, pathTo } from "@/lib/routes";

export type RowUser = {
  id: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN";
  status: "invited" | "active" | "deactivated";
  hasPendingInvite: boolean;
};

type ConfirmKind = "deactivate" | "revoke";

export function UserRowActions({ user }: { user: RowUser }) {
  const t = useTranslations("users");
  const translateKey = useTranslateKey();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Outlives confirmOpen so the closing dialog keeps its text.
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>("deactivate");
  const [shown, setShown] = useState<ShownInvite | null>(null);
  const [pending, setPending] = useState(false);

  if (user.role === "SUPER_ADMIN") return null;

  const id = { id: user.id };

  function askToConfirm(kind: ConfirmKind) {
    setConfirmKind(kind);
    setConfirmOpen(true);
  }
  const name = { name: user.name };

  async function run(
    method: "POST" | "DELETE",
    path: string,
    notify?: "deactivated" | "reactivated" | "revoked",
  ) {
    setPending(true);
    const result = await apiRequest<{
      invite?: { path: string; expiresAt: string };
    }>(method, path);
    setPending(false);
    setConfirmOpen(false);

    if (!result.ok) {
      toast.add({
        title: translateKey(errorMessageKey(result.code, result.detail)),
        type: "error",
      });
      return;
    }

    if (result.data?.invite)
      setShown({ ...result.data.invite, name: user.name });
    if (notify)
      toast.add({ title: t(`notify.${notify}`, name), type: "success" });
    router.refresh();
  }

  const active = user.status !== "deactivated";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" />}
          aria-label={t("list.actionsFor", name)}
          disabled={pending}
        >
          {pending && !confirmOpen ? (
            <Spinner aria-hidden />
          ) : (
            <EllipsisIcon aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {active ? (
            <>
              <DropdownMenuItem
                onClick={() => run("POST", pathTo(API_ROUTES.userInvite, id))}
              >
                {t("actions.issueLink")}
              </DropdownMenuItem>
              {user.hasPendingInvite && (
                <DropdownMenuItem onClick={() => askToConfirm("revoke")}>
                  {t("actions.revokeLink")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => askToConfirm("deactivate")}
              >
                {t("actions.deactivate")}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={() =>
                run(
                  "POST",
                  pathTo(API_ROUTES.userReactivate, id),
                  "reactivated",
                )
              }
            >
              {t("actions.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmKind === "revoke"
                ? t("actions.confirmRevokeTitle", name)
                : t("actions.confirmDeactivateTitle", name)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKind === "revoke"
                ? t("actions.confirmRevoke")
                : t("actions.confirmDeactivate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirmKind === "deactivate" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                confirmKind === "revoke"
                  ? run("DELETE", pathTo(API_ROUTES.userInvite, id), "revoked")
                  : run(
                      "POST",
                      pathTo(API_ROUTES.userDeactivate, id),
                      "deactivated",
                    )
              }
            >
              {pending && <Spinner data-icon="inline-start" aria-hidden />}
              {confirmKind === "revoke"
                ? t("actions.revokeLink")
                : t("actions.deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </>
  );
}
