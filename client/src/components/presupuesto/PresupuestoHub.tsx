import type { ReactNode } from "react";
import type { TabId } from "../Header";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import { PRESUPUESTO_HUB_ITEMS, type PresupuestoVista } from "./presupuesto-hub-items";

interface Props {
  vista: PresupuestoVista | "menu";
  onNavigate: (id: TabId) => void;
  onVolverDashboard: () => void;
  onVolver: () => void;
  apiOnline: boolean;
  title: string;
  subtitle?: string;
  embedded?: boolean;
  children: ReactNode;
}

export default function PresupuestoHub({
  vista,
  onNavigate,
  onVolverDashboard,
  onVolver,
  apiOnline,
  title,
  subtitle,
  embedded = true,
  children,
}: Props) {
  return (
    <div className="sg-module-page presupuesto-module-page">
      <SgHubShell
        activeId={vista}
        items={PRESUPUESTO_HUB_ITEMS}
        onNavigate={(id) => onNavigate(id as TabId)}
        onVolverDashboard={onVolverDashboard}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={title}
        subtitle={subtitle}
        asideKicker="SAG"
        asideTitle="Presupuesto y gastos"
        asideLogo={<MenuAppIcon id="registro" />}
        navAriaLabel="Módulos de presupuesto"
        hubClassName="presupuesto--hub"
      >
        {embedded ? <div className="sg-hub-embedded">{children}</div> : children}
      </SgHubShell>
    </div>
  );
}
