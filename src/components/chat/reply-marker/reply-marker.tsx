"use client";

import { type MessageStatus, useAuiState } from "@assistant-ui/react";
import {
  CircleAlertIcon,
  CircleStopIcon,
  LoaderCircleIcon,
  ScissorsIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ChatOutcome } from "@/lib/chat/messages";
import { cn } from "@/lib/utils";

type MarkedOutcome = Exclude<ChatOutcome, "completed">;

const MARKERS = {
  stopped: { key: "markers.stopped", Icon: CircleStopIcon },
  cut: { key: "markers.cut", Icon: ScissorsIcon },
  failed: { key: "markers.failed", Icon: CircleAlertIcon },
  in_progress: { key: "markers.inProgress", Icon: LoaderCircleIcon },
} as const satisfies Record<MarkedOutcome, unknown>;

/** The live status wins over the stored outcome; the runtime knows nothing of cut or of a reload (R10). */
export function markedOutcome(
  status: MessageStatus | undefined,
  stored: unknown,
): MarkedOutcome | null {
  if (status?.type === "running") return null;
  if (status?.type === "incomplete" && status.reason === "cancelled") {
    return "stopped";
  }
  if (status?.type === "incomplete" && status.reason === "error") {
    return "failed";
  }
  return typeof stored === "string" && Object.hasOwn(MARKERS, stored)
    ? (stored as MarkedOutcome)
    : null;
}

export function ReplyMarker({ outcome }: { outcome: MarkedOutcome | null }) {
  const t = useTranslations("chat");
  if (!outcome) return null;
  const { key, Icon } = MARKERS[outcome];

  return (
    <p
      data-outcome={outcome}
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        outcome === "failed" && "text-destructive",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-3.5",
          outcome === "in_progress" &&
            "animate-spin motion-reduce:animate-none",
        )}
      />
      {t(key)}
    </p>
  );
}

/** The marker of the reply in the current message scope. */
export function MessageReplyMarker() {
  const outcome = useAuiState((s) =>
    markedOutcome(s.message.status, s.message.metadata.custom.outcome),
  );
  return <ReplyMarker outcome={outcome} />;
}
