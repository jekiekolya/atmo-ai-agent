import type { FinishReason } from "ai";

import type { StoredFinish } from "@/lib/chat/messages";

export type ReplyEnd = {
  errored: boolean;
  isAborted: boolean;
  clientAborted: boolean;
  finishReason: FinishReason | undefined;
};

/** How a reply ended, as stored (research R4's outcome table). */
export function decideOutcome({
  errored,
  isAborted,
  clientAborted,
  finishReason,
}: ReplyEnd): Exclude<StoredFinish, "IN_PROGRESS"> {
  if (
    errored ||
    finishReason === "error" ||
    finishReason === "content-filter"
  ) {
    return "FAILED";
  }
  if (isAborted) return clientAborted ? "STOPPED" : "FAILED";
  if (finishReason === "length") return "CUT";
  return "COMPLETED";
}
