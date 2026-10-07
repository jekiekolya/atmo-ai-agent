import { describe, expect, it } from "vitest";

import { buildInstructions } from "@/server/chat/instructions";

const en = buildInstructions({ locale: "en", today: "2026-10-04" });
const uk = buildInstructions({ locale: "uk", today: "2026-10-04" });

describe("buildInstructions", () => {
  it("gives the model today's date verbatim", () => {
    expect(en).toContain("2026-10-04");
  });

  it("presents Atmo's support assistant for solar energy", () => {
    expect(en).toMatch(/Atmo/);
    expect(en).toMatch(/support assistant/i);
    expect(en).toMatch(/solar/i);
  });

  it("tells the model to reply in the language of the user's latest message", () => {
    expect(en).toMatch(/language of the user's latest message/i);
  });

  it.each([
    ["en", "English"],
    ["uk", "Ukrainian"],
  ] as const)("falls back to the page language for %s: %s", (locale, name) => {
    expect(buildInstructions({ locale, today: "2026-10-04" })).toMatch(
      new RegExp(`otherwise[^.]*\\b${name}\\b`, "i"),
    );
  });

  it("names only the fallback language of its own locale", () => {
    expect(en).not.toMatch(/Ukrainian/);
    expect(uk).not.toMatch(/\bEnglish\b/);
  });

  it("states it has no access to customer data, contracts, or systems, and says so when asked", () => {
    expect(en).toMatch(/no access to/i);
    expect(en).toMatch(/data/i);
    expect(en).toMatch(/contracts/i);
    expect(en).toMatch(/systems/i);
    expect(en).toMatch(/say so plainly/i);
  });

  it("forbids inventing facts about a customer's system, contract, or entitlements", () => {
    expect(en).toMatch(/never invent/i);
    expect(en).toMatch(/entitlements/i);
  });

  it("is identical for identical input", () => {
    expect(buildInstructions({ locale: "en", today: "2026-10-04" })).toBe(en);
  });
});
