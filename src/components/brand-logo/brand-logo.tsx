import type { StaticImageData } from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import logoAsset from "./atmo-ai-logo.svg";

// Next types every .svg import as `any` so SVGR setups type-check; ours is a static import.
const logo: StaticImageData = logoAsset;

/** The "atmo AI" logo, drawn from the asset so its colours follow the active theme. */
export function BrandLogo({ className }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <svg
      role="img"
      aria-label={t("appName")}
      viewBox={`0 0 ${logo.width} ${logo.height}`}
      className={cn("text-foreground", className)}
    >
      <use href={`${logo.src}#logo`} />
    </svg>
  );
}
