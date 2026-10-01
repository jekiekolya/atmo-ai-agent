export const E2E_DATABASE_URL =
  "postgresql://atmo:atmo@localhost:5432/atmo_e2e";

export const E2E_AUTH_SECRET = "e2e-secret-at-least-32-characters-long!";

export const SUPER_ADMIN = {
  email: "owner@e2e.test",
  firstName: "Olena",
  lastName: "Kovalenko",
  password: "e2e owner password",
} as const;
