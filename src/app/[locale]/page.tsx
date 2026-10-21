import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BenefitCards } from "@/components/landing/benefit-cards/benefit-cards";
import { LandingHero } from "@/components/landing/landing-hero/landing-hero";
import { AppShell } from "@/components/shell/app-shell/app-shell";
import { BrandLogo } from "@/components/shell/brand-logo/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PAGES } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  const common = await getTranslations("common");
  return {
    // The layout's title template skips the page of its own segment.
    title: {
      absolute: common("titleTemplate").replace("%s", t("metaTitle")),
    },
    description: t("metaDescription"),
  };
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const common = await getTranslations("common");

  return (
    <AppShell
      logo={
        <Link href={PAGES.home} className="rounded-sm">
          <BrandLogo className="h-6 w-auto" />
        </Link>
      }
      account={
        <Link
          href={PAGES.signIn}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("signIn")}
        </Link>
      }
      footer={common("appName")}
    >
      <LandingHero />
      <BenefitCards />
    </AppShell>
  );
}
