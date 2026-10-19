import { Clock, History, Languages, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";

const BENEFITS = [
  { id: "allHours", Icon: Clock },
  { id: "language", Icon: Languages },
  { id: "history", Icon: History },
  { id: "solar", Icon: Sun },
] as const;

export function BenefitCards() {
  const t = useTranslations("landing");

  return (
    <section className="relative mx-auto grid w-full max-w-5xl gap-4 px-4 pb-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
      {BENEFITS.map(({ id, Icon }) => (
        <Card key={id}>
          <CardContent className="flex flex-col gap-2">
            <Icon className="size-6 text-brand-mark" />
            <h2 className="font-medium">{t(`benefits.${id}.title`)}</h2>
            <p className="text-muted-foreground">{t(`benefits.${id}.body`)}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
