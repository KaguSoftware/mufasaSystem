import { StudioProjectPage } from "@/components/studio/studio-pages";

export default async function AdminStudioProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioProjectPage id={projectId} base="/admin/studio" />;
}
