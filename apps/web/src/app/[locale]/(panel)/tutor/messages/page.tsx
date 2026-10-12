import { MessagesView } from "@/components/messaging/messages-view";

export default async function TutorMessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const sp = await searchParams;
  return <MessagesView base="tutor" threadId={sp.thread} />;
}
