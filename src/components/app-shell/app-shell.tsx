import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";

export function AppShell({
  logo,
  nav,
  account,
  children,
}: {
  logo?: ReactNode;
  nav?: ReactNode;
  account?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        {logo && <div className="flex shrink-0 items-center">{logo}</div>}
        {nav && (
          <div className="order-last w-full overflow-x-auto sm:order-0 sm:w-auto">
            {nav}
          </div>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
          {account}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
