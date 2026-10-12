import { PanelGate } from "@/components/shell/panel-gate";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <PanelGate role="student">{children}</PanelGate>;
}
