import type { ReactNode } from "react";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import { NOTAS_HUB_ITEMS } from "./notas-hub-items";
import type { NotasVistaId } from "./notas-hub-items";

interface Props {
  vista: NotasVistaId;
  onNavigate: (id: NotasVistaId) => void;
  onVolver: () => void;
  apiOnline: boolean;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function NotasHub({
  vista,
  onNavigate,
  onVolver,
  apiOnline,
  title,
  subtitle,
  headerActions,
  children,
}: Props) {
  return (
    <div className="sg-module-page notas-module-page">
      <SgHubShell
        activeId={vista}
        items={NOTAS_HUB_ITEMS}
        onNavigate={(id) => onNavigate(id as NotasVistaId)}
        onVolverDashboard={() => onNavigate("todas")}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
        asideKicker="SGG · Productividad"
        asideTitle="Notas"
        asideLogo={<MenuAppIcon id="notas" />}
        navAriaLabel="Vistas de notas"
        showDashboardInNav={false}
        hubClassName="notas--hub"
      >
        <div className="sg-hub-embedded notas-workspace">{children}</div>
      </SgHubShell>
    </div>
  );
}
