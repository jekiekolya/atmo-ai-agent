import { act, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

import type { Locale } from "./locales";
import type { InstantFormat } from "./use-format-instant";

const MESSAGES = { en, uk } as const;
const MORNING = new Date("2026-03-14T09:30:00Z");
const LATE = new Date("2026-03-14T23:30:00Z");

type Probe = { value: Date; format: InstantFormat };

/**
 * Imports the hook fresh, so its once-per-page zone cache starts empty. The
 * provider comes from the same import graph as the hook it serves.
 */
async function load() {
  vi.resetModules();
  const { NextIntlClientProvider } = await import("next-intl");
  const { useFormatInstant } = await import("./use-format-instant");

  function Value({ value, format }: Probe) {
    const formatInstant = useFormatInstant();
    return <span>{formatInstant(value, format)}</span>;
  }

  return function tree(locale: Locale, ...probes: Probe[]) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone="UTC"
      >
        {probes.map((probe, index) => (
          <Value key={index} {...probe} />
        ))}
      </NextIntlClientProvider>
    );
  };
}

/** What the browser reports as its zone, for the readers this file cannot run as. */
function reportZone(timeZone: string | undefined) {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return {
        ...real.call(this),
        timeZone,
      } as Intl.ResolvedDateTimeFormatOptions;
    },
  );
}

async function clientText(locale: Locale, ...probes: Probe[]) {
  const tree = await load();
  return render(tree(locale, ...probes)).container.textContent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFormatInstant", () => {
  it("runs in a non-UTC zone, so no case below passes by accident", () => {
    expect(["Europe/Kyiv", "Europe/Kiev"]).toContain(
      new Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  describe("before the reader's zone is known (FR-004, FR-008, FR-021)", () => {
    it("renders UTC with its label, date-only values included", async () => {
      const tree = await load();

      const english = renderToString(
        tree(
          "en",
          { value: MORNING, format: "dateTime" },
          { value: LATE, format: "date" },
        ),
      );
      expect(english).toMatch(/Mar 14, 2026, 09:30\sAM\sUTC/);
      expect(english).toMatch(/Mar 14, 2026, UTC/);

      const ukrainian = renderToString(
        tree(
          "uk",
          { value: MORNING, format: "dateTime" },
          { value: LATE, format: "date" },
        ),
      );
      expect(ukrainian).toMatch(/14 бер\. 2026 р\., 09:30\sUTC/);
      expect(ukrainian).toMatch(/14 бер\. 2026 р\., UTC/);
    });
  });

  describe("once the reader's zone is known (FR-007, FR-012, FR-021)", () => {
    it("renders the reader's zone without a label", async () => {
      const text = await clientText(
        "en",
        { value: MORNING, format: "dateTime" },
        { value: LATE, format: "date" },
      );

      expect(text).toMatch(/Mar 14, 2026, 11:30\sAM/);
      expect(text).toContain("Mar 15, 2026");
      expect(text).not.toContain("UTC");
    });

    it("keeps the page's language whatever the zone (FR-002)", async () => {
      const text = await clientText(
        "uk",
        { value: MORNING, format: "dateTime" },
        { value: LATE, format: "date" },
      );

      expect(text).toMatch(/14 бер\. 2026 р\., 11:30/);
      expect(text).toContain("15 бер. 2026 р.");
      expect(text).not.toContain("UTC");
    });

    it("treats UTC as the reader's own zone, unlabelled (FR-009)", async () => {
      reportZone("UTC");

      const text = await clientText("en", {
        value: MORNING,
        format: "dateTime",
      });

      expect(text).toMatch(/Mar 14, 2026, 09:30\sAM/);
      expect(text).not.toContain("UTC");
    });

    it("uses the offset in effect at each instant, across a daylight-saving change (FR-013)", async () => {
      // New York moves from UTC−5 to UTC−4 on 8 March 2026; Kyiv's own rules may change.
      reportZone("America/New_York");

      const text = await clientText(
        "en",
        { value: new Date("2026-03-07T14:30:00Z"), format: "dateTime" },
        { value: new Date("2026-03-09T13:30:00Z"), format: "dateTime" },
      );

      expect(text).toMatch(/Mar 7, 2026, 09:30\sAM/);
      expect(text).toMatch(/Mar 9, 2026, 09:30\sAM/);
      expect(text).not.toContain("UTC");
    });
  });

  it("replaces the labelled UTC with the local value on hydration, without a mismatch (FR-006)", async () => {
    const tree = await load();
    const node = tree("en", { value: MORNING, format: "dateTime" });
    const container = document.createElement("div");
    container.innerHTML = renderToString(node);
    document.body.append(container);
    expect(container.textContent).toContain("UTC");

    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, node, { onRecoverableError });
    });

    expect(container.textContent).toMatch(/Mar 14, 2026, 11:30\sAM/);
    expect(container.textContent).not.toContain("UTC");
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    act(() => root?.unmount());
    container.remove();
  });

  it.each([["Etc/Unknown"], [undefined]])(
    "stays in labelled UTC when the browser reports no usable zone (%s)",
    async (zone) => {
      reportZone(zone);

      const text = await clientText("en", {
        value: MORNING,
        format: "dateTime",
      });

      expect(text).toMatch(/Mar 14, 2026, 09:30\sAM\sUTC/);
    },
  );

  it("reads the zone once for the whole page (FR-017)", async () => {
    const read = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions");

    const text = await clientText(
      "en",
      { value: MORNING, format: "dateTime" },
      { value: MORNING, format: "dateTime" },
    );

    expect(text).toMatch(/(11:30\sAM).*\1/);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
