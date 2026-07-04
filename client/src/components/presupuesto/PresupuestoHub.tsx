import type { ReactNode } from "react";
import type { TabId } from "../Header";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import {
  PRESUPUESTO_HUB_ITEMS,
  PRESUPUESTO_HUB_META,
  type PresupuestoVista,
} from "./presupuesto-hub-items";

interface Props {
  vista: PresupuestoVista;
  onNavigate: (id: TabId) => void;
  onVolver: () => void;
  apiOnline: boolean;
  children: ReactNode;
}

export default function PresupuestoHub({
  vista,
  onNavigate,
  onVolver,
  apiOnline,
  children,
}: Props) {
  const meta = PRESUPUESTO_HUB_META[vista];

  return (
    <div className="sg-module-page presupuesto-module-page">
      <SgHubShell
        activeId={vista}
        items={PRESUPUESTO_HUB_ITEMS}
        onNavigate={(id) => onNavigate(id as TabId)}
        onVolverDashboard={() => onNavigate("registro")}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={meta.title}
        subtitle={meta.subtitle}
        asideKicker="SGG · Presupuesto"
        asideTitle="Control de gastos"
        asideLogo={<MenuAppIcon id="listado" />}
        navAriaLabel="Módulos de presupuesto"
      >
        <div className="sg-hub-embedded">{children}</div>
      </SgHubShell>
    </div>
  );
}
