import { loadConfig } from "./schema";

export type { Config } from "./schema";

// The one place in the application that reads process.env
export const config = loadConfig(process.env);
