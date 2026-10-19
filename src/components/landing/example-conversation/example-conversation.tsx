import { useTranslations } from "next-intl";

const DOT_DELAYS = [
  "[animation-delay:800ms]",
  "[animation-delay:900ms]",
  "[animation-delay:1000ms]",
];

export function ExampleConversation() {
  const t = useTranslations("landing");
  const common = useTranslations("common");

  return (
    <figure className="flex animate-in flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 duration-500 fade-in motion-reduce:animate-none">
      <figcaption className="text-xs text-muted-foreground">
        {t("example.caption")}
      </figcaption>
      <div className="max-w-[85%] animate-in self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground delay-300 duration-300 fill-mode-backwards fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
        <span className="sr-only">
          {t("example.speaker", { name: t("example.customer") })}{" "}
        </span>
        {t("example.question")}
      </div>
      <div className="relative max-w-[85%] self-start">
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 flex animate-typing-indicator gap-1 rounded-lg bg-muted px-3 py-3 motion-reduce:hidden"
        >
          {DOT_DELAYS.map((delay) => (
            <span
              key={delay}
              className={`size-1.5 animate-typing-dot rounded-full bg-muted-foreground ${delay}`}
            />
          ))}
        </div>
        <div className="animate-in rounded-lg bg-muted px-3 py-2 text-foreground delay-[1800ms] duration-400 fill-mode-backwards fade-in motion-reduce:animate-none">
          <span className="sr-only">
            {t("example.speaker", { name: common("appName") })}{" "}
          </span>
          {t("example.answer")}
        </div>
      </div>
    </figure>
  );
}
