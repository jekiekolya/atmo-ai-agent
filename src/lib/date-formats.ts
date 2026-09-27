import type { DateTimeFormatOptions } from "next-intl";

// Intl rejects dateStyle/timeStyle combined with timeZoneName, so the parts are spelled out.
export const ZONED_DATE_TIME: DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
};
