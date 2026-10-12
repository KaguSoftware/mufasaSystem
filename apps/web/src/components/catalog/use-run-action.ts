"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/components/ui/toast";
import { errorMessageKey } from "@/server/errors";
import type { ActionResult } from "@/server/action";

/**
 * Runs a server action, toasts the outcome and refreshes the page data.
 * Returns the raw result so forms can read `fieldErrors`.
 */
export function useRunAction() {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();

  return async function run<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string | false; refresh?: boolean } = {},
  ): Promise<ActionResult<T>> {
    const res = await fn();
    if (!res.ok) {
      const key = errorMessageKey[res.error.code] as Parameters<typeof t>[0];
      toast.error(res.error.code === "integration_not_configured" ? t(key, { name: res.error.message ?? "" }) : t(key));
    } else {
      if (opts.success !== false) toast.success(opts.success ?? tc("saved"));
      if (opts.refresh !== false) router.refresh();
    }
    return res;
  };
}
