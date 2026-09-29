"use client";

import { getSession, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { signInUrlFor } from "@/lib/http/callback-url";
import { hardNavigate } from "@/lib/http/hard-navigate";

function toSignIn() {
  hardNavigate(signInUrlFor(window.location));
}

/** Server rendering never renews the session cookie, so each page load and navigation asks the endpoint. */
export function SessionKeepAlive() {
  const pathname = usePathname();
  // Also fires when SessionProvider's refetch on a refocused tab finds the session refused (FR-071).
  useSession({ required: true, onUnauthenticated: toSignIn });

  useEffect(() => {
    // Not broadcast: SessionProvider would answer with a second request for the same result.
    void getSession({ broadcast: false }).then((session) => {
      if (!session) toSignIn();
    });
  }, [pathname]);

  return null;
}
