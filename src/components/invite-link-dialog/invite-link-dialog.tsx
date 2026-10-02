"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useFormatInstant } from "@/i18n/use-format-instant";

export type ShownInvite = { path: string; expiresAt: string; name: string };

export function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: ShownInvite | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const formatInstant = useFormatInstant();
  const url = invite ? `${window.location.origin}${invite.path}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      toast.add({ title: t("users.invite.copyFailed"), type: "error" });
      return;
    }
    toast.add({ title: t("users.invite.copied"), type: "success" });
  }

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("dialog.close")}>
        {invite && (
          <>
            <DialogHeader>
              <DialogTitle>{t("users.invite.title")}</DialogTitle>
              <DialogDescription className="wrap-break-word">
                {t("users.invite.description", {
                  name: invite.name,
                  expiresAt: formatInstant(
                    new Date(invite.expiresAt),
                    "dateTime",
                  ),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-link">{t("users.invite.linkLabel")}</Label>
              <Input
                id="invite-link"
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
              />
              <p className="text-sm text-muted-foreground">
                {t("users.invite.shownOnce")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copy}>
                {t("users.invite.copy")}
              </Button>
              <Button onClick={onClose}>{t("users.invite.done")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
