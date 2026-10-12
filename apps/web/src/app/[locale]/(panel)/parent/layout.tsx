import { PanelGate } from "@/components/shell/panel-gate";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <PanelGate role="parent">{children}</PanelGate>;
}
