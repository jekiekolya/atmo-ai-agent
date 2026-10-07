import type { UIMessage } from "ai";

import type { ChatPart, StoredFinish } from "@/lib/chat/messages";

export type HistoryRow = {
  id: string;
  role: "USER" | "ASSISTANT";
  parts: ChatPart[];
  finishReason: StoredFinish | null;
};

/** What the model sees: ended replies without their reasoning, the last `limit` messages (FR-042, R6). */
export function toModelHistory(rows: HistoryRow[], limit: number): UIMessage[] {
  const messages: UIMessage[] = [];

  for (const row of rows) {
    if (row.role === "USER") {
      messages.push({ id: row.id, role: "user", parts: row.parts });
      continue;
    }
    if (row.finishReason === "FAILED" || row.finishReason === "IN_PROGRESS") {
      continue;
    }
    const parts = row.parts.filter((part) => part.type !== "reasoning");
    if (parts.length > 0) {
      messages.push({ id: row.id, role: "assistant", parts });
    }
  }

  return messages.slice(-limit);
}
