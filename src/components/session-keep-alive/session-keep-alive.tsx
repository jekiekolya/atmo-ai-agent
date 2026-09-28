"use client";

import { getSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { signInUrlFor } from "@/lib/http/callback-url";
import { hardNavigate } from "@/lib/http/hard-navigate";

/** Server rendering never renews the session cookie, so each navigation asks the endpoint. */
export function SessionKeepAlive() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;

    void getSession().then((session) => {
      if (!session) hardNavigate(signInUrlFor(window.location));
    });
  }, [pathname]);

  return null;
}
