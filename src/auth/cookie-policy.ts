import type { Config } from "@/config";

// Shared by next-auth and the proxy guard: the cookie name and decryption salt derive from it.
export function secureCookiesFor(config: Pick<Config, "appEnv">): boolean {
  return config.appEnv !== "development";
}
