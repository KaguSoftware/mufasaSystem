import { NotificationsPage } from "@/components/account/notifications-page";

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return <NotificationsPage role="admin" page={sp.page} />;
}
