const WINDOW_MS = 24 * 60 * 60 * 1000;

export type UsageRow = {
  createdAt: Date;
  inputTokens: number | null;
  outputTokens: number | null;
};

const tokensOf = (row: UsageRow) =>
  (row.inputTokens ?? 0) + (row.outputTokens ?? 0);

/** When enough of the window's replies have aged out for the total to fall below the budget (FR-055, R5). */
export function secondsUntilBudgetFrees(
  replies: UsageRow[],
  budget: number,
  now: Date,
): number {
  const oldestFirst = [...replies].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let remaining = oldestFirst.reduce((sum, row) => sum + tokensOf(row), 0);

  for (const row of oldestFirst) {
    remaining -= tokensOf(row);
    if (remaining < budget) {
      const leavesAt = row.createdAt.getTime() + WINDOW_MS;
      return Math.max(1, Math.ceil((leavesAt - now.getTime()) / 1000));
    }
  }
  return Math.ceil(WINDOW_MS / 1000);
}
