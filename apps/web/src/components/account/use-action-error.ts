"use client";
import { useTranslations } from "next-intl";
import { errorMessageKey, type ErrorCode } from "@/server/errors";

/** Maps an ActionResult error to a localized message (errors.*). */
export function useErrorText() {
  const t = useTranslations("errors");
  return (e: { code: ErrorCode; message?: string }) =>
    t(errorMessageKey[e.code] as "generic", { name: e.message ?? "" });
}
