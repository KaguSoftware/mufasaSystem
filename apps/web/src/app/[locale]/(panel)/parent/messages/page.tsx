import { MessagesView } from "@/components/messaging/messages-view";

export default async function ParentMessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const sp = await searchParams;
  return <MessagesView base="parent" threadId={sp.thread} />;
}
