import { NotificationsPage } from "@/components/account/notifications-page";

export default async function StudentNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return <NotificationsPage role="student" page={sp.page} />;
}
