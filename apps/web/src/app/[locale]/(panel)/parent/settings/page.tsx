import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function ParentSettingsPage() {
  return redirect({ href: "/parent/account", locale: await getLocale() });
}
