import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Roboto } from "next/font/google";
import type { Metadata } from "next";

import { Toaster } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";
import { DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY } from "@/lib/theme";

import "../globals.css";

// "optional" never swaps after first paint, so text cannot shift (spec 005, FR-015).
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  display: "optional",
});

// The root layout: `app/layout.tsx` is deliberately absent so `<html lang>`
// is rendered by a layout that knows the locale (FR-010).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// An unlisted segment 404s at the routing layer, so no page needs its own guard.
export const dynamicParams = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");

  return {
    title: { template: t("titleTemplate"), default: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations("notifications");

  return (
    <html
      lang={locale}
      className={`${roboto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Outermost inside <body>: its pre-paint script must precede anything that paints. */}
        <ThemeProvider
          attribute="class"
          defaultTheme={DEFAULT_THEME_PREFERENCE}
          storageKey={THEME_STORAGE_KEY}
        >
          <NextIntlClientProvider>
            <Toaster regionLabel={t("region")} closeLabel={t("close")}>
              {children}
            </Toaster>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
