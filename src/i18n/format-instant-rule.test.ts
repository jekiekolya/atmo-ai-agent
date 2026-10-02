import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// FR-016: proves the repository's own lint config stops a date formatted
// outside useFormatInstant, without stopping the code that is allowed to.
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const VIOLATIONS = {
  "next-intl's formatter": `export const f = (format: { dateTime(d: Date, o: object): string }, d: Date) => format.dateTime(d, {});`,
  toLocaleDateString: `export const f = (d: Date) => d.toLocaleDateString();`,
  toLocaleString: `export const f = (d: Date) => d.toLocaleString();`,
  "Intl.DateTimeFormat": `export const f = () => new Intl.DateTimeFormat("en");`,
};

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT });
});

async function restricted(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
}

describe("the date-formatting rule", () => {
  it.each(Object.entries(VIOLATIONS))(
    "reports %s in screen code, at its line",
    async (_name, code) => {
      const messages = await restricted(
        `\n${code}`,
        "src/components/probe/probe.tsx",
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain("useFormatInstant");
      expect(messages[0].line).toBe(2);
    },
    30_000,
  );

  it.each([
    ["the mechanism itself", "src/i18n/use-format-instant.ts"],
    ["browser-less server code", "src/server/probe.ts"],
    ["a test", "src/components/probe/probe.test.tsx"],
  ])(
    "leaves %s alone",
    async (_name, filePath) => {
      const messages = await restricted(
        VIOLATIONS["next-intl's formatter"],
        filePath,
      );

      expect(messages).toEqual([]);
    },
    30_000,
  );

  it("still enforces Principle V in screen code, which a second rule block would silently replace", async () => {
    const messages = await restricted(
      `export const url = process.env.DATABASE_URL;`,
      "src/components/probe/probe.tsx",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("process.env");
  }, 30_000);
});
