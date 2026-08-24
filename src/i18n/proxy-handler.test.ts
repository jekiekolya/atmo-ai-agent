import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { handleLocaleRequest } from "./proxy-handler";

function request(
  path: string,
  init: { acceptLanguage?: string; cookie?: string } = {},
) {
  const headers = new Headers();
  if (init.acceptLanguage) headers.set("accept-language", init.acceptLanguage);
  if (init.cookie) headers.set("cookie", `NEXT_LOCALE=${init.cookie}`);
  // Only document requests reach the locale logic; next-intl ignores the rest.
  headers.set("sec-fetch-dest", "document");
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

const location = (res: Response) => {
  const value = res.headers.get("location");
  return value ? new URL(value).pathname + new URL(value).search : null;
};

describe("locale resolution order (FR-006)", () => {
  it("prefers the URL segment over everything else", () => {
    const res = handleLocaleRequest(
      request("/uk/", { acceptLanguage: "en", cookie: "en" }),
    );

    expect(res.status).toBe(200);
  });

  it("uses the cookie when the URL carries no locale", () => {
    const res = handleLocaleRequest(
      request("/", { acceptLanguage: "en", cookie: "uk" }),
    );

    expect(location(res)).toBe("/uk");
  });

  it("negotiates from accept-language when there is no cookie", () => {
    const res = handleLocaleRequest(
      request("/", { acceptLanguage: "uk-UA,uk;q=0.9" }),
    );

    expect(location(res)).toBe("/uk");
  });

  it("falls back to the default when nothing is usable", () => {
    const res = handleLocaleRequest(request("/"));

    expect(location(res)).toBe("/en");
  });
});

describe("unsupported values fall through (FR-008, FR-009)", () => {
  it("ignores a cookie naming an unsupported locale", () => {
    const res = handleLocaleRequest(
      request("/", { cookie: "de", acceptLanguage: "uk" }),
    );

    expect(location(res)).toBe("/uk");
  });

  it("serves the default when accept-language names only unsupported locales", () => {
    const res = handleLocaleRequest(
      request("/", { acceptLanguage: "de,fr;q=0.8" }),
    );

    expect(location(res)).toBe("/en");
  });

  it("maps a regional variant to its base locale", () => {
    const res = handleLocaleRequest(request("/", { acceptLanguage: "en-GB" }));

    expect(location(res)).toBe("/en");
  });
});

describe("redirect shape (FR-007, FR-031)", () => {
  it("preserves the path and query byte-for-byte", () => {
    const res = handleLocaleRequest(
      request("/demo/42?tab=notes&x=1", { acceptLanguage: "uk" }),
    );

    expect(location(res)).toBe("/uk/demo/42?tab=notes&x=1");
  });

  it("redirects temporarily, never permanently", () => {
    const res = handleLocaleRequest(request("/", { acceptLanguage: "uk" }));

    expect([307, 302]).toContain(res.status);
  });

  it("forbids caching the redirect, since its target varies per visitor", () => {
    const res = handleLocaleRequest(request("/", { acceptLanguage: "uk" }));

    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the preference is never written by serving a page (FR-030)", () => {
  it("does not set a cookie on a redirect", () => {
    const res = handleLocaleRequest(request("/", { acceptLanguage: "uk" }));

    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("does not overwrite a stored choice when a shared link is followed", () => {
    // The recipient chose English; the link is Ukrainian. They read Ukrainian,
    // but their own preference must survive for the next unprefixed visit.
    const res = handleLocaleRequest(request("/uk/demo/42", { cookie: "en" }));

    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("does not create a cookie for a visitor who has never chosen", () => {
    const res = handleLocaleRequest(request("/uk/", { acceptLanguage: "en" }));

    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
