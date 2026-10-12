import { StudioProjectPage } from "@/components/studio/studio-pages";

export default async function TutorStudioProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioProjectPage id={projectId} base="/tutor/studio" />;
}
