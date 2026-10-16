"use client";

import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { DeleteConversationDialog } from "@/components/chat/delete-conversation-dialog/delete-conversation-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { PAGES, pathTo } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type ConversationSummary = { id: string; title: string };

/** The user's conversations, most recent first; folds away on narrow screens (FR-029, FR-030, FR-034). */
export function ConversationList({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const t = useTranslations("chat.list");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const close = () => setOpen(false);

  return (
    <div className="flex min-h-0 flex-col md:h-full">
      <div className="flex items-center justify-between gap-2 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {t("toggle")}
          <ChevronDownIcon
            aria-hidden
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
        <Link
          href={PAGES.chat}
          onClick={close}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "md:w-full",
          })}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          {t("newChat")}
        </Link>
      </div>
      <nav
        id={panelId}
        aria-label={t("label")}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-2 pb-2 md:block",
          open ? "block" : "hidden",
        )}
      >
        {conversations.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => {
              const href = pathTo(PAGES.chatConversation, {
                id: conversation.id,
              });
              const current = pathname === href;
              return (
                <li
                  key={conversation.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md hover:bg-muted",
                    current && "bg-muted",
                  )}
                >
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={current ? "page" : undefined}
                    className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm"
                  >
                    {conversation.title}
                  </Link>
                  <DeleteConversationDialog
                    conversation={conversation}
                    isOpenConversation={current}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
