import { describe, expect, it } from "vitest";

import { deriveTitle } from "@/server/chat/title";

describe("deriveTitle", () => {
  it("collapses runs of whitespace and trims the ends", () => {
    expect(deriveTitle("  How   does\tan\n\ninverter work?  ")).toBe(
      "How does an inverter work?",
    );
  });

  it("keeps a text of 80 characters as it is", () => {
    const text = "a".repeat(80);
    expect(deriveTitle(text)).toBe(text);
  });

  it("cuts a text of 81 characters to the first 80 and an ellipsis", () => {
    expect(deriveTitle(`${"a".repeat(80)}b`)).toBe(`${"a".repeat(80)}…`);
  });

  it("counts the length after collapsing whitespace", () => {
    expect(deriveTitle(`${"a ".repeat(40)}   `)).toBe(`${"a ".repeat(39)}a`);
  });

  it("never splits a character made of two UTF-16 units", () => {
    expect(deriveTitle("😀".repeat(81))).toBe(`${"😀".repeat(80)}…`);
  });

  it("gives the one word of a text wrapped in line breaks", () => {
    expect(deriveTitle("\n\n\nInverter\n\n")).toBe("Inverter");
  });
});
