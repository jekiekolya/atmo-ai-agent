"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "type" | "ref">) {
  const t = useTranslations("passwordInput");
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    // Masked before the form's own submit handler can start the request (FR-005).
    const mask = () => flushSync(() => setVisible(false));
    form.addEventListener("submit", mask);
    return () => form.removeEventListener("submit", mask);
  }, []);

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        ref={input}
        type={visible ? "text" : "password"}
        disabled={disabled}
        // Kept inside the group's border, so an autofill background stays within its rounded corners.
        className={cn(
          "h-full rounded-l-[calc(var(--radius-lg)-1px)] [&::-ms-reveal]:hidden",
          className,
        )}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? t("hide") : t("show")}
          disabled={disabled}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
