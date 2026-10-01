"use client";

import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { useTranslateKey } from "@/i18n/use-translate-key";
import { routeFailure, toFormErrors } from "@/lib/http/form-errors";

type Failure = Parameters<typeof routeFailure>[0];

/** Puts a failed request's message under its field, in the form's alert, or in a notification. */
export function useFormFailure() {
  const translateKey = useTranslateKey();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);

  function show(failure: Failure, messages?: Partial<Record<string, string>>) {
    const route = routeFailure(failure, messages);
    if (route.kind === "fields") {
      setErrors(toFormErrors(route.fields, translateKey));
      if (route.alertKey) setAlert(translateKey(route.alertKey));
    } else if (route.kind === "alert") {
      setAlert(translateKey(route.key));
    } else {
      toast.add({ title: translateKey(route.key), type: "error" });
    }
  }

  function clear() {
    setErrors({});
    setAlert(null);
  }

  return { errors, alert, show, clearAlert: () => setAlert(null), clear };
}
