import { describe, expect, it } from "vitest";

import { loadConfig } from "@/config/schema";

// Literal sources rather than a mutated process.env: the environment is read in
// exactly one place (Constitution, Principle V), tests included.
const valid = {
  NODE_ENV: "test",
  APP_ENV: "development",
  DATABASE_URL: "postgresql://user:password@localhost:5432/atmo_dev",
  AUTH_SECRET: "a".repeat(32),
};

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
    const config = loadConfig({
      ...valid,
      NODE_ENV: "production",
      APP_ENV: "staging",
    });

    expect(config.nodeEnv).toBe("production");
    expect(config.appEnv).toBe("staging");
  });

  it.each(["postgresql", "postgres"])(
    "accepts a %s:// connection string",
    (scheme) => {
      const url = `${scheme}://user:password@localhost:5432/atmo_dev`;

      expect(loadConfig({ ...valid, DATABASE_URL: url }).databaseUrl).toBe(url);
    },
  );

  it("fails naming DATABASE_URL when it is not a URL", () => {
    expect(() =>
      loadConfig({ ...valid, DATABASE_URL: "localhost:5432" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("fails naming DATABASE_URL when it addresses another database engine", () => {
    expect(() =>
      loadConfig({
        ...valid,
        DATABASE_URL: "mysql://atmo@localhost:3306/atmo",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it.each(["NODE_ENV", "APP_ENV", "DATABASE_URL", "AUTH_SECRET"])(
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

    expect(Object.keys(config).sort()).toEqual([
      "appEnv",
      "authSecret",
      "databaseUrl",
      "nodeEnv",
      "sessionAbsoluteLifetimeSeconds",
      "sessionMaxAgeSeconds",
    ]);
  });

  describe("sessions", () => {
    it("fails naming AUTH_SECRET when it is shorter than 32 characters", () => {
      expect(() =>
        loadConfig({ ...valid, AUTH_SECRET: "a".repeat(31) }),
      ).toThrow(/AUTH_SECRET/);
    });

    it("exposes the secret", () => {
      expect(loadConfig(valid).authSecret).toBe("a".repeat(32));
    });

    it("defaults to an eight-hour rolling window and a 24-hour absolute lifetime", () => {
      const config = loadConfig(valid);

      expect(config.sessionMaxAgeSeconds).toBe(28_800);
      expect(config.sessionAbsoluteLifetimeSeconds).toBe(86_400);
    });

    it("coerces both lifetimes from strings", () => {
      const config = loadConfig({
        ...valid,
        SESSION_MAX_AGE_SECONDS: "3600",
        SESSION_ABSOLUTE_LIFETIME_SECONDS: "7200",
      });

      expect(config.sessionMaxAgeSeconds).toBe(3600);
      expect(config.sessionAbsoluteLifetimeSeconds).toBe(7200);
    });

    it.each(["0", "-1", "1.5", "soon"])(
      "rejects SESSION_MAX_AGE_SECONDS=%s",
      (value) => {
        expect(() =>
          loadConfig({ ...valid, SESSION_MAX_AGE_SECONDS: value }),
        ).toThrow(/SESSION_MAX_AGE_SECONDS/);
      },
    );

    it.each(["0", "-1", "1.5", "soon"])(
      "rejects SESSION_ABSOLUTE_LIFETIME_SECONDS=%s",
      (value) => {
        expect(() =>
          loadConfig({ ...valid, SESSION_ABSOLUTE_LIFETIME_SECONDS: value }),
        ).toThrow(/SESSION_ABSOLUTE_LIFETIME_SECONDS/);
      },
    );

    it("fails naming both lifetimes when the absolute one is shorter", () => {
      expect(() =>
        loadConfig({
          ...valid,
          SESSION_MAX_AGE_SECONDS: "7200",
          SESSION_ABSOLUTE_LIFETIME_SECONDS: "3600",
        }),
      ).toThrow(/SESSION_ABSOLUTE_LIFETIME_SECONDS[^]*SESSION_MAX_AGE_SECONDS/);
    });

    it("accepts equal lifetimes", () => {
      expect(() =>
        loadConfig({
          ...valid,
          SESSION_MAX_AGE_SECONDS: "3600",
          SESSION_ABSOLUTE_LIFETIME_SECONDS: "3600",
        }),
      ).not.toThrow();
    });
  });
});
