import { signInUrlFor } from "@/lib/http/callback-url";
import { hardNavigate } from "@/lib/http/client/hard-navigate";
import { API_ROUTES } from "@/lib/routes";
import type { FieldErrors } from "@/server/errors";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; detail?: string; fields?: FieldErrors };

type Method = "POST" | "PUT" | "DELETE";

export function redirectToSignIn(): Promise<never> {
  hardNavigate(signInUrlFor(window.location));
  // The page is going away; nothing should react to this request any more.
  return new Promise<never>(() => {});
}

// A route handler's auth() cannot write the renewed cookie, so the client asks for it (research R3).
export function renewSession(): void {
  void fetch(API_ROUTES.session, { cache: "no-store" }).catch(() => undefined);
}

/** The forms' only way to call our API. Never throws for an HTTP error. */
export async function apiRequest<T = undefined>(
  method: Method,
  path: string,
  body?: unknown,
  options: { unauthenticated?: "redirect" | "resolve" } = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  if (response.status === 401) {
    return options.unauthenticated === "resolve"
      ? { ok: false, code: "unauthenticated" }
      : redirectToSignIn();
  }
  renewSession();
  if (response.status >= 500) return { ok: false, code: "unexpected" };
  if (response.status === 204) return { ok: true, data: undefined as T };

  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) return { ok: true, data: payload as T };

  const error = (
    payload as {
      error?: { code?: string; detail?: string; fields?: FieldErrors };
    } | null
  )?.error;
  return {
    ok: false,
    code: error?.code ?? "unexpected",
    detail: error?.detail,
    fields: error?.fields,
  };
}
