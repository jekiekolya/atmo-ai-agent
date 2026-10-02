"use client";

import { type DateTimeFormatOptions, useFormatter } from "next-intl";
import { useSyncExternalStore } from "react";

export type InstantFormat = "date" | "dateTime";

// Intl rejects dateStyle/timeStyle combined with timeZoneName, so the parts are spelled out.
const DATE: DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const FORMATS: Record<InstantFormat, DateTimeFormatOptions> = {
  date: DATE,
  dateTime: { ...DATE, hour: "2-digit", minute: "2-digit" },
};

let readerZone: string | null | undefined;

function readZone(): string | null {
  if (readerZone !== undefined) return readerZone;

  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  readerZone = isUsable(zone) ? zone : null;
  return readerZone;
}

function isUsable(zone: string | undefined): zone is string {
  if (!zone || zone === "Etc/Unknown") return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const neverChanges = () => () => {};

// The server cannot know the reader's zone; null keeps the hydration render identical to the server's.
const unknownOnServer = () => null;

/** The one way to show an instant on screen: the reader's zone once known, labelled UTC before. */
export function useFormatInstant(): (
  value: Date,
  format: InstantFormat,
) => string {
  const format = useFormatter();
  const zone = useSyncExternalStore(neverChanges, readZone, unknownOnServer);

  return (value, name) =>
    format.dateTime(
      value,
      zone
        ? { ...FORMATS[name], timeZone: zone }
        : { ...FORMATS[name], timeZone: "UTC", timeZoneName: "short" },
    );
}
