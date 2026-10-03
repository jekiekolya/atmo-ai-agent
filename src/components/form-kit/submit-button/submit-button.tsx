import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "disabled"> & {
  pending: boolean;
  pendingLabel: ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && <Spinner data-icon="inline-start" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
