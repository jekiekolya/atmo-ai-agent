import { describe, expect, it } from "vitest";

import { loadConfig } from "@/config/schema";

// Literal sources rather than a mutated process.env: the environment is read in
// exactly one place (Constitution, Principle V), tests included.
const valid = {
  NODE_ENV: "test",
  APP_ENV: "local",
  DATABASE_URL: "postgresql://user:password@localhost:5432/atmo_dev",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
};

describe("loadConfig", () => {
  it.each(["development", "test", "production"] as const)(
    "accepts NODE_ENV=%s",
    (value) => {
      expect(loadConfig({ ...valid, NODE_ENV: value }).nodeEnv).toBe(value);
    },
  );

  it.each(["local", "dev", "staging", "production"] as const)(
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
      /APP_ENV.*local.*dev.*staging.*production/,
    );
  });

  it("rejects APP_ENV=development, the former name of local", () => {
    expect(() => loadConfig({ ...valid, APP_ENV: "development" })).toThrow(
      /APP_ENV/,
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
      "ai",
      "appEnv",
      "authSecret",
      "chat",
      "databaseUrl",
      "nodeEnv",
      "sessionAbsoluteLifetimeSeconds",
      "sessionMaxAgeSeconds",
    ]);
    expect(Object.keys(config.ai).sort()).toEqual([
      "fakeModel",
      "googleApiKey",
    ]);
    expect(Object.keys(config.chat).sort()).toEqual([
      "dailyTokenBudget",
      "historyLimit",
      "maxMessageLength",
      "rateLimitPerMinute",
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

  describe("the chat agent", () => {
    it("exposes the provider key and the real model by default", () => {
      expect(loadConfig(valid).ai).toEqual({
        googleApiKey: "test-google-key",
        fakeModel: false,
      });
    });

    it.each([
      ["true", true],
      ["false", false],
      [undefined, false],
    ])("parses AI_FAKE_MODEL=%s as %s", (value, expected) => {
      expect(loadConfig({ ...valid, AI_FAKE_MODEL: value }).ai.fakeModel).toBe(
        expected,
      );
    });

    it("rejects an AI_FAKE_MODEL that is not a boolean", () => {
      expect(() => loadConfig({ ...valid, AI_FAKE_MODEL: "maybe" })).toThrow(
        /AI_FAKE_MODEL/,
      );
    });

    it.each([undefined, "false"])(
      "fails naming GOOGLE_GENERATIVE_AI_API_KEY when it is missing and AI_FAKE_MODEL=%s",
      (fake) => {
        expect(() =>
          loadConfig({
            ...valid,
            GOOGLE_GENERATIVE_AI_API_KEY: undefined,
            AI_FAKE_MODEL: fake,
          }),
        ).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
      },
    );

    it("needs no provider key with the test model", () => {
      const config = loadConfig({
        ...valid,
        GOOGLE_GENERATIVE_AI_API_KEY: undefined,
        AI_FAKE_MODEL: "true",
      });

      expect(config.ai).toEqual({ googleApiKey: undefined, fakeModel: true });
    });

    it("refuses the test model in production", () => {
      expect(() =>
        loadConfig({ ...valid, APP_ENV: "production", AI_FAKE_MODEL: "true" }),
      ).toThrow(/AI_FAKE_MODEL/);
    });

    it("freezes the agent settings", () => {
      expect(Object.isFrozen(loadConfig(valid).ai)).toBe(true);
    });
  });

  describe("chat limits", () => {
    it("defaults to 4000 characters, 10 a minute, 500000 tokens a day, and 50 messages of context", () => {
      expect(loadConfig(valid).chat).toEqual({
        maxMessageLength: 4000,
        rateLimitPerMinute: 10,
        dailyTokenBudget: 500_000,
        historyLimit: 50,
      });
    });

    it("coerces every limit from a string", () => {
      const config = loadConfig({
        ...valid,
        CHAT_MAX_MESSAGE_LENGTH: "100",
        CHAT_RATE_LIMIT_PER_MINUTE: "2",
        CHAT_DAILY_TOKEN_BUDGET: "1000",
        CHAT_HISTORY_LIMIT: "3",
      });

      expect(config.chat).toEqual({
        maxMessageLength: 100,
        rateLimitPerMinute: 2,
        dailyTokenBudget: 1000,
        historyLimit: 3,
      });
    });

    describe.each([
      "CHAT_MAX_MESSAGE_LENGTH",
      "CHAT_RATE_LIMIT_PER_MINUTE",
      "CHAT_DAILY_TOKEN_BUDGET",
      "CHAT_HISTORY_LIMIT",
    ])("%s", (key) => {
      it.each(["0", "-1", "1.5", "soon"])("rejects %s", (value) => {
        expect(() => loadConfig({ ...valid, [key]: value })).toThrow(
          new RegExp(key),
        );
      });
    });

    it("freezes the limits", () => {
      expect(Object.isFrozen(loadConfig(valid).chat)).toBe(true);
    });
  });
});
