"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { signInUrlFor } from "@/lib/http/callback-url";
import { hardNavigate } from "@/lib/http/client/hard-navigate";
import { API_ROUTES } from "@/lib/routes";

// Not getSession(): it reports a failed request as no session, and a dropped connection is not a sign-out.
async function isRefused(): Promise<boolean> {
  try {
    const response = await fetch(API_ROUTES.session, { cache: "no-store" });
    return response.ok && (await response.json()) === null;
  } catch {
    return false;
  }
}

async function leaveIfRefused() {
  if (await isRefused()) hardNavigate(signInUrlFor(window.location));
}

/** Server rendering never renews the session cookie, so each page load, navigation and return to the tab asks the endpoint. */
export function SessionKeepAlive() {
  const pathname = usePathname();

  useEffect(() => {
    void leaveIfRefused();
  }, [pathname]);

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void leaveIfRefused();
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => document.removeEventListener("visibilitychange", onReturn);
  }, []);

  return null;
}
