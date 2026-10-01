import "dotenv/config";

// Deploy-time tooling: process.env and plain English output are allowed here.
import { parseBootstrapEnv } from "./bootstrap-env";

// Config requires NODE_ENV and npm does not set it; must run before the database module loads.
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "production" });

async function main(): Promise<number> {
  const settings = parseBootstrapEnv(process.env);

  if (!settings.success) {
    console.error(
      ["Invalid bootstrap settings:", ...settings.errors].join("\n"),
    );
    return 1;
  }

  const { db } = await import("@/server/db");
  const { bootstrapSuperAdmin } = await import("@/server/users/user-service");

  try {
    const result = await bootstrapSuperAdmin(settings.data);

    switch (result.outcome) {
      case "created":
        console.log(`Created super admin ${result.email}.`);
        return 0;
      case "exists":
        console.log(
          `A super admin already exists (${result.email}); left untouched.`,
        );
        return 0;
      case "email_taken":
        console.error(
          `Cannot create super admin: ${result.email} already belongs to another account.`,
        );
        return 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
