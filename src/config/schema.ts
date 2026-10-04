import { z } from "zod";

// Kept apart from the process.env read in ./index.ts so tests can exercise this
// contract without loading the singleton.
const positiveSeconds = z.coerce.number().int().positive();
const positiveCount = z.coerce.number().int().positive();

const schema = z
  .object({
    // Owned by Next, which warns on any other value: staging is a production
    // build, not a fourth mode.
    NODE_ENV: z.enum(["development", "test", "production"]),

    // Deployment target, orthogonal to NODE_ENV. No default: a deploy that forgets
    // it must fail at boot, not quietly behave like a developer's laptop.
    APP_ENV: z.enum(["development", "staging", "production"]),

    // Prisma speaks only PostgreSQL here, so a connection string for another
    // engine is a misconfiguration worth catching at boot rather than on the
    // first query.
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    AUTH_SECRET: z.string().min(32),

    SESSION_MAX_AGE_SECONDS: positiveSeconds.default(28_800),

    SESSION_ABSOLUTE_LIFETIME_SECONDS: positiveSeconds.default(86_400),

    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),

    AI_FAKE_MODEL: z.stringbool().default(false),

    CHAT_MAX_MESSAGE_LENGTH: positiveCount.default(4000),

    CHAT_RATE_LIMIT_PER_MINUTE: positiveCount.default(10),

    CHAT_DAILY_TOKEN_BUDGET: positiveCount.default(500_000),

    CHAT_HISTORY_LIMIT: positiveCount.default(50),
  })
  .refine(
    (env) =>
      env.SESSION_ABSOLUTE_LIFETIME_SECONDS >= env.SESSION_MAX_AGE_SECONDS,
    {
      path: ["SESSION_ABSOLUTE_LIFETIME_SECONDS"],
      error: "must not be shorter than SESSION_MAX_AGE_SECONDS",
    },
  )
  .refine(
    (env) =>
      env.AI_FAKE_MODEL || env.GOOGLE_GENERATIVE_AI_API_KEY !== undefined,
    {
      path: ["GOOGLE_GENERATIVE_AI_API_KEY"],
      error: "is required unless AI_FAKE_MODEL is true",
    },
  )
  .refine((env) => !(env.AI_FAKE_MODEL && env.APP_ENV === "production"), {
    path: ["AI_FAKE_MODEL"],
    error: "must not be true when APP_ENV is production",
  });

type Env = z.infer<typeof schema>;

export type Config = Readonly<{
  nodeEnv: Env["NODE_ENV"];
  appEnv: Env["APP_ENV"];
  databaseUrl: string;
  authSecret: string;
  sessionMaxAgeSeconds: number;
  sessionAbsoluteLifetimeSeconds: number;
  ai: Readonly<
    | { fakeModel: false; googleApiKey: string }
    | { fakeModel: true; googleApiKey: string | undefined }
  >;
  chat: Readonly<{
    maxMessageLength: number;
    rateLimitPerMinute: number;
    dailyTokenBudget: number;
    historyLimit: number;
  }>;
}>;

export function loadConfig(source: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;
  const ai: Config["ai"] = env.AI_FAKE_MODEL
    ? { fakeModel: true, googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY }
    : // The refine above guarantees the key when the real model is in use.
      { fakeModel: false, googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY! };

  return Object.freeze({
    nodeEnv: parsed.data.NODE_ENV,
    appEnv: parsed.data.APP_ENV,
    databaseUrl: parsed.data.DATABASE_URL,
    authSecret: parsed.data.AUTH_SECRET,
    sessionMaxAgeSeconds: parsed.data.SESSION_MAX_AGE_SECONDS,
    sessionAbsoluteLifetimeSeconds:
      parsed.data.SESSION_ABSOLUTE_LIFETIME_SECONDS,
    ai: Object.freeze(ai),
    chat: Object.freeze({
      maxMessageLength: env.CHAT_MAX_MESSAGE_LENGTH,
      rateLimitPerMinute: env.CHAT_RATE_LIMIT_PER_MINUTE,
      dailyTokenBudget: env.CHAT_DAILY_TOKEN_BUDGET,
      historyLimit: env.CHAT_HISTORY_LIMIT,
    }),
  });
}
