// Entries use the folder syntax of src/app, so routes.test.ts can match them against it.

/** Without the locale segment: next-intl's Link and redirect add it. */
export const PAGES = {
  home: "/",
  signIn: "/sign-in",
  invite: "/invite/[token]",
  dashboard: "/dashboard",
  account: "/dashboard/account",
  users: "/dashboard/users",
} as const;

export const AUTH_BASE_PATH = "/api/auth";

export const API_ROUTES = {
  session: `${AUTH_BASE_PATH}/session`,
  users: "/api/users",
  userInvite: "/api/users/[id]/invite",
  userDeactivate: "/api/users/[id]/deactivate",
  userReactivate: "/api/users/[id]/reactivate",
  acceptInvite: "/api/invites/accept",
  password: "/api/account/password",
  signOut: "/api/session/sign-out",
} as const;

type ParamNames<Pattern extends string> =
  Pattern extends `${string}[${infer Name}]${infer Rest}`
    ? Name | ParamNames<Rest>
    : never;

export function pathTo<Pattern extends string>(
  pattern: Pattern,
  params: Record<ParamNames<Pattern>, string>,
): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_, name: ParamNames<Pattern>) =>
    encodeURIComponent(params[name]),
  );
}
