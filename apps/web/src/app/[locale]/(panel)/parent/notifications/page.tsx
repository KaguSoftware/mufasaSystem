import { NotificationsPage } from "@/components/account/notifications-page";

export default async function ParentNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return <NotificationsPage role="parent" page={sp.page} />;
}
