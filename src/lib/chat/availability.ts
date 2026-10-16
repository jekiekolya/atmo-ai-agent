export type Availability =
  { underHour: true } | { underHour: false; hours: number };

/** "In about N hours", rounded up, or "in less than an hour" (FR-055). */
export function hoursUntilAvailable(seconds: number): Availability {
  if (seconds < 3_600) return { underHour: true };
  return { underHour: false, hours: Math.ceil(seconds / 3_600) };
}
