import { useTranslations } from "next-intl";

import { ExampleConversation } from "@/components/landing/example-conversation/example-conversation";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PAGES } from "@/lib/routes";

export function LandingHero() {
  const t = useTranslations("landing");

  return (
    <section className="relative isolate overflow-x-clip">
      <div
        aria-hidden="true"
        className="absolute top-3/4 left-1/2 -z-10 size-[44rem] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-mark/10 blur-3xl"
      />
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-2 md:items-center md:py-20">
        <div className="flex animate-in flex-col items-start gap-6 duration-500 fade-in motion-reduce:animate-none">
          <h1 className="text-4xl font-medium text-balance">{t("headline")}</h1>
          <p className="text-lg text-foreground">{t("subheading")}</p>
          <Link href={PAGES.signIn} className={buttonVariants({ size: "lg" })}>
            {t("signIn")}
          </Link>
        </div>
        <ExampleConversation />
      </div>
    </section>
  );
}
