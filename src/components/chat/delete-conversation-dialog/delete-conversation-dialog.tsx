"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { apiRequest } from "@/lib/http/client/api-client";
import { routeFailure } from "@/lib/http/client/form-errors";
import { API_ROUTES, PAGES, pathTo } from "@/lib/routes";

/** Delete behind a confirmation that says it is permanent (FR-032). */
export function DeleteConversationDialog({
  conversation,
  isOpenConversation,
}: {
  conversation: { id: string; title: string };
  isOpenConversation: boolean;
}) {
  const t = useTranslations("chat");
  const translateKey = useTranslateKey();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const title = { title: conversation.title };

  async function remove() {
    setPending(true);
    const result = await apiRequest(
      "DELETE",
      pathTo(API_ROUTES.chatConversation, { id: conversation.id }),
    );
    setPending(false);
    setOpen(false);

    if (!result.ok) {
      const route = routeFailure(result, { not_found: "chat.errors.notFound" });
      toast.add({
        title: translateKey(
          route.kind === "fields" ? "errors.unexpected" : route.key,
        ),
        type: "error",
      });
      router.refresh();
      return;
    }

    toast.add({ title: t("delete.done"), type: "success" });
    // A navigation keeps the shared layout as it was; the refresh re-renders the list.
    if (isOpenConversation) router.push(PAGES.chat);
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={t("list.delete", title)}
      >
        <Trash2Icon aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("delete.description", title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={remove}
          >
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {t("delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
