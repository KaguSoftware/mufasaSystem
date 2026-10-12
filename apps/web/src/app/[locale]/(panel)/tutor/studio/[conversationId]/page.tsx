import { StudioConversationPage } from "@/components/studio/studio-pages";

export default async function TutorStudioConversation({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return <StudioConversationPage id={conversationId} base="/tutor/studio" />;
}
