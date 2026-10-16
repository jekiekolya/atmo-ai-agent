import { redirectToSignIn, renewSession } from "@/lib/http/client/api-client";

/** The chat transport's fetch: apiRequest's sign-in and keep-alive, with the body left unread for the stream. */
export async function chatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) return redirectToSignIn();
  renewSession();
  return response;
}
