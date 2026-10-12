import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { HOME_FOR_ROLE } from "@/components/shell/nav";
import { getSession } from "@/server/session";

/** /dashboard sends each user to their own panel. */
export default async function DashboardRedirect() {
  const locale = await getLocale();
  const session = await getSession();
  if (!session) return redirect({ href: "/sign-in?next=/dashboard", locale });
  return redirect({ href: HOME_FOR_ROLE[session.user.role], locale });
}
