# Contract: Addresses and Locale Resolution

**Requirements**: FR-005 – FR-011, FR-013, FR-030, FR-031 · **Enforced by**: `src/proxy.ts`, `src/i18n/proxy-handler.ts`, `src/i18n/routing.ts`

This is the observable HTTP contract. Every row is directly testable; the proxy handler tests assert
them without a browser, and the Playwright suite re-asserts the visitor-facing subset.

## Address shape

| Rule                                    | Value                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| Every page address                      | `/{locale}/...`, always prefixed, default locale included (FR-005) |
| Locale segment                          | exactly one of `en`, `uk`                                          |
| Unprefixed page address serving content | none exists                                                        |

## Resolution table

Given a request, the served locale is the first source that yields a supported locale (FR-006):

| #   | Source                  | Ignored when                                                     |
| --- | ----------------------- | ---------------------------------------------------------------- |
| 1   | first path segment      | not a supported locale                                           |
| 2   | `NEXT_LOCALE` cookie    | absent, or value not a supported locale (FR-008)                 |
| 3   | `Accept-Language`       | no supported match; regional variants map to their base (FR-009) |
| 4   | `DEFAULT_LOCALE` (`en`) | never — terminal                                                 |

## Response contract

| Request                                              | Status | Location                                                           | `Set-Cookie`                                                              | `Cache-Control`     |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------- |
| `/en/…`, `/uk/…`                                     | 200    | —                                                                  | **none** (FR-030)                                                         | route default       |
| `/` (no cookie, `Accept-Language: uk`)               | 307    | `/uk`                                                              | **none**                                                                  | `no-store` (FR-031) |
| `/` (no cookie, `Accept-Language: de`)               | 307    | `/en`                                                              | **none**                                                                  | `no-store`          |
| `/` (no cookie, no `Accept-Language`)                | 307    | `/en`                                                              | **none**                                                                  | `no-store`          |
| `/` (cookie `NEXT_LOCALE=uk`, `Accept-Language: en`) | 307    | `/uk`                                                              | **none**                                                                  | `no-store`          |
| `/` (cookie `NEXT_LOCALE=de`)                        | 307    | negotiated from `Accept-Language`                                  | **none**                                                                  | `no-store`          |
| `/settings?tab=a` (negotiates `uk`)                  | 307    | `/uk/settings?tab=a` — path and query byte-for-byte (FR-007)       | **none**                                                                  | `no-store`          |
| `/uk/…` while cookie is `en`                         | 200    | —                                                                  | **none** — the shared-link case; the cookie is _not_ overwritten (FR-030) | route default       |
| `/de/dashboard`                                      | 307    | `/{negotiated}/de/dashboard`, then the localized 404 renders there | **none**                                                                  | `no-store`          |

## Unmatched paths

| Request                                     | Result                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/uk/demo` (no case number), `/uk/whatever` | 404 **rendered as a localized page**: `lang="uk"`, Ukrainian copy, switcher present |
| the same under `/en/...`                    | the same in English                                                                 |

A path inside a locale that matches no route does not fall through to the framework's own error
screen. Switching language from one of these lands on the same path under the other locale, where its
not-found page renders.

## Exclusions

The proxy matcher must not run on non-page addresses (FR-011): `/api/*`, `/_next/static/*`,
`/_next/image/*`, `favicon.ico`, `robots.txt`, `sitemap.xml`, and any path containing a file
extension. These stay reachable unprefixed and unredirected.

> Note from the Next.js proxy docs: `_next/data` routes invoke the proxy even when excluded by a
> negative matcher. Harmless here — the handler leaves anything without a page path alone — but do
> not be surprised by it in a trace.

## Internal navigation

All internal links and programmatic navigation go through the helpers exported by
`src/i18n/navigation.ts` (`Link`, `useRouter`, `usePathname`, `redirect`), never `next/link` or raw
strings (MC-001). This is what makes FR-005 hold by construction: a helper cannot produce an
unprefixed address.

## Locale switch

Switching locale is a navigation to the same pathname with a different locale, which preserves every
remaining segment and the query string (FR-013):

```text
/uk/demo/42?tab=notes  --switch to en-->  /en/demo/42?tab=notes
```

The cookie write that accompanies it happens in the browser, not in the proxy (FR-030).
