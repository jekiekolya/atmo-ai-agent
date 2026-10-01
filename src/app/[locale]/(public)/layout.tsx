import { AppShell } from "@/components/app-shell/app-shell";

export default function PublicLayout({ children }: LayoutProps<"/[locale]">) {
  return <AppShell>{children}</AppShell>;
}
