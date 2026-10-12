import { PanelGate } from "@/components/shell/panel-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PanelGate role="admin">{children}</PanelGate>;
}
