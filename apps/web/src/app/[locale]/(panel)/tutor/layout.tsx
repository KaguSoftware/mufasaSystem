import { PanelGate } from "@/components/shell/panel-gate";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return <PanelGate role="tutor">{children}</PanelGate>;
}
