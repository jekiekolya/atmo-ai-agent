import { z } from "zod";

// Kept apart from the process.env read in ./index.ts so tests can exercise this
// contract without loading the singleton.
const schema = z.object({
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
});

export type Config = Readonly<{
  nodeEnv: z.infer<typeof schema>["NODE_ENV"];
  appEnv: z.infer<typeof schema>["APP_ENV"];
  databaseUrl: string;
}>;

export function loadConfig(source: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return Object.freeze({
    nodeEnv: parsed.data.NODE_ENV,
    appEnv: parsed.data.APP_ENV,
    databaseUrl: parsed.data.DATABASE_URL,
  });
}
