"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// A navigation that settles sooner never paints or announces the loader (spec 005, FR-031).
const REVEAL_DELAY_MS = 300;

const OUTER =
  "M62.7771 48.4094C62.7771 56.3436 56.3441 62.7766 48.4099 62.7766H15.5904C7.65614 62.7766 1.22314 56.3436 1.22314 48.4094V15.5899C1.22314 7.65567 7.65615 1.22266 15.5904 1.22266H48.4099C56.3441 1.22266 62.7771 7.65566 62.7771 15.5899V48.4094Z";

const INNER =
  "M16 41.3131V36.8805C16 33.2016 16.86 30.3781 18.5921 28.4018C20.3243 26.4248 22.7283 25.4408 25.8155 25.4408H41.5969V23.0157C41.5969 22.5025 41.4616 22.0564 41.175 21.6374C40.6505 20.8934 39.9887 20.5332 39.1847 20.5332H16V14.3999H38.8624C41.4364 14.3999 43.4519 14.9297 44.9349 15.9992C46.3997 17.0686 47.4285 18.8062 48 21.2102V22.8442V41.7922C48 43.5161 47.5526 45.0901 46.65 46.4926C44.6139 49.6249 41.9548 51.1999 38.6845 51.1999H25.8866C24.1738 51.1999 22.4234 50.6223 20.619 49.4876C19.1014 48.5341 17.9568 47.3994 17.172 46.0826C16.3873 44.7648 16 43.1734 16 41.3131ZM23.94 44.4795C23.2539 44.0976 22.7283 43.293 22.3969 42.0658V41.4495V35.5296V34.8449C22.9682 32.8938 24.4757 31.7991 26.9153 31.576H27.5568H36.5163H37.1577C38.587 31.7124 39.6126 31.986 40.2032 32.4322C40.8019 32.8589 41.2665 33.6644 41.5969 34.8449V35.5296V41.4495V42.0658C41.2228 43.293 40.7013 44.0976 40.0599 44.4795C39.4185 44.8671 38.1854 45.0608 36.371 45.0608H27.6228C25.8602 45.0608 24.6292 44.8671 23.94 44.4795Z";

/** The "a" mark drawing itself, as on my.atmo.pro, shown while a page waits on the server. */
export function PageLoader() {
  const t = useTranslations("loader");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" className="flex justify-center px-4 py-24">
      {visible && (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            fill="none"
            strokeWidth={2}
            className="size-16"
          >
            <path
              d={OUTER}
              className="animate-loader-outer stroke-current text-foreground [stroke-dasharray:230] [stroke-dashoffset:230] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            />
            <path
              d={INNER}
              fillRule="evenodd"
              clipRule="evenodd"
              className="animate-loader-inner stroke-brand-mark [stroke-dasharray:200] [stroke-dashoffset:200] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            />
          </svg>
          <span className="sr-only">{t("label")}</span>
        </>
      )}
    </div>
  );
}
