"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { errorMessageKey } from "@/server/errors";
import type { ActionResult } from "@/server/action";

/** Runs a server action, toasts success or a translated error and optionally refreshes server data. */
export function useAction() {
  const te = useTranslations("errors");
  const router = useRouter();

  return async function run<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string; refresh?: boolean; silentError?: boolean } = {},
  ): Promise<ActionResult<T>> {
    const res = await fn();
    if (!res.ok) {
      if (!opts.silentError) {
        const key = errorMessageKey[res.error.code] as Parameters<typeof te>[0];
        toast.error(res.error.code === "integration_not_configured" ? te(key, { name: res.error.message ?? "" }) : te(key));
      }
    } else {
      if (opts.success) toast.success(opts.success);
      if (opts.refresh !== false) router.refresh();
    }
    return res;
  };
}
