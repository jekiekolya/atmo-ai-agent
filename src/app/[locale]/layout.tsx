import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";

import { LocaleSwitcher } from "@/components/locale-switcher/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { routing } from "@/i18n/routing";
import { DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY } from "@/lib/theme";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
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

  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
            <header className="flex items-center justify-end gap-2 p-4">
              <ThemeToggle />
              <LocaleSwitcher />
            </header>
            <main className="flex-1">{children}</main>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
