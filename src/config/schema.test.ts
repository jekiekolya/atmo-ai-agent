import { describe, expect, it } from "vitest";

import { loadConfig } from "@/config/schema";

// Literal sources rather than a mutated process.env: the environment is read in
// exactly one place (Constitution, Principle V), tests included.
const valid = { NODE_ENV: "test", APP_ENV: "development" };

describe("loadConfig", () => {
  it.each(["development", "test", "production"] as const)(
    "accepts NODE_ENV=%s",
    (value) => {
      expect(loadConfig({ ...valid, NODE_ENV: value }).nodeEnv).toBe(value);
    },
  );

  it.each(["development", "staging", "production"] as const)(
    "accepts APP_ENV=%s",
    (value) => {
      expect(loadConfig({ ...valid, APP_ENV: value }).appEnv).toBe(value);
    },
  );

  it("keeps the deployment target independent of the build mode", () => {
    const config = loadConfig({ NODE_ENV: "production", APP_ENV: "staging" });

    expect(config).toEqual({ nodeEnv: "production", appEnv: "staging" });
  });

  it.each(["NODE_ENV", "APP_ENV"])(
    "fails naming %s when it is missing",
    (key) => {
      const source: Record<string, string | undefined> = { ...valid };
      delete source[key];

      expect(() => loadConfig(source)).toThrow(new RegExp(key));
    },
  );

  it("fails naming NODE_ENV and its allowed values when it is unknown", () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: "prod" })).toThrow(
      /NODE_ENV.*development.*test.*production/,
    );
  });

  it("rejects NODE_ENV=staging", () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: "staging" })).toThrow(
      /NODE_ENV/,
    );
  });

  it("fails naming APP_ENV and its allowed values when it is unknown", () => {
    expect(() => loadConfig({ ...valid, APP_ENV: "prod" })).toThrow(
      /APP_ENV.*development.*staging.*production/,
    );
  });

  it("reports every invalid variable at once", () => {
    const error = (() => {
      try {
        loadConfig({ NODE_ENV: "nope", APP_ENV: "nope" });
      } catch (thrown) {
        return thrown as Error;
      }
    })();

    expect(error?.message).toMatch(/NODE_ENV/);
    expect(error?.message).toMatch(/APP_ENV/);
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(loadConfig(valid))).toBe(true);
  });

  it("drops variables it does not declare", () => {
    const config = loadConfig({ ...valid, PARTNER_SECRET: "x" });

    expect(Object.keys(config).sort()).toEqual(["appEnv", "nodeEnv"]);
  });
});
