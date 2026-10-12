"use client";

import { Toaster as Sonner, toast } from "sonner";
import { useLocale } from "next-intl";
import { isRtl } from "@mufasa/config/locales";

/** Mounted once in the root layout. Call `toast.success("…")` anywhere on the client. */
export function Toaster() {
  const locale = useLocale();
  return (
    <Sonner
      dir={isRtl(locale) ? "rtl" : "ltr"}
      position={isRtl(locale) ? "bottom-left" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-border !bg-surface !text-text !shadow-pop !font-sans",
          description: "!text-muted",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}

export { toast };
