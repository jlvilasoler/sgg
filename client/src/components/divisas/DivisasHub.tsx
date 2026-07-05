import type { ReactNode } from "react";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import { DIVISAS_HUB_ITEMS } from "./divisas-hub-items";
import type { DivisasMonedaId } from "./divisas-config";

interface Props {
  vista: DivisasMonedaId | "menu";
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  onVolver: () => void;
  apiOnline: boolean;
  title: string;
  subtitle?: string;
  embedded?: boolean;
  children: ReactNode;
}

export default function DivisasHub({
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
    <div className="sg-module-page divisas-module-page">
      <SgHubShell
        activeId={vista}
        items={DIVISAS_HUB_ITEMS}
        onNavigate={onNavigate}
        onVolverDashboard={onVolverDashboard}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={title}
        subtitle={subtitle}
        asideKicker="SAG"
        asideTitle="Divisas"
        asideLogo={<MenuAppIcon id="divisas" />}
        navAriaLabel="Monedas en divisas"
        hubClassName="divisas--hub"
      >
        {embedded ? <div className="sg-hub-embedded">{children}</div> : children}
      </SgHubShell>
    </div>
  );
}
