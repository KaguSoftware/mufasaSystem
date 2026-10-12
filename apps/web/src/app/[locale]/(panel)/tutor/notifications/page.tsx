import { NotificationsPage } from "@/components/account/notifications-page";

export default async function TutorNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return <NotificationsPage role="tutor" page={sp.page} />;
}
