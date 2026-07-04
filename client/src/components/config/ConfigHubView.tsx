import type { ReactNode } from "react";
import { useMemo } from "react";
import type { AuthUser } from "../../types";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import {
  buildConfigNavItems,
  configHubMeta,
  type ConfigNavScope,
} from "./config-hub-items";

interface Props {
  activeId: string;
  navScope: ConfigNavScope;
  esSuperAdmin: boolean;
  cuentaNombre: string;
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  onVolverInicio?: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function ConfigHubView({
  activeId,
  navScope,
  esSuperAdmin,
  cuentaNombre,
  apiOnline,
  currentUser,
  onNavigate,
  onVolverDashboard,
  onVolverInicio,
  title,
  subtitle,
  children,
}: Props) {
  const items = useMemo(
    () => buildConfigNavItems(navScope, currentUser, esSuperAdmin),
    [navScope, currentUser, esSuperAdmin]
  );
  const meta = configHubMeta(activeId, cuentaNombre);
  const isDashboard =
    activeId === "menu" || activeId === "cuenta_hub" || activeId === "sag_hub";

  return (
    <div className="sg-module-page config-module-page">
      <SgHubShell
        activeId={activeId}
        items={items}
        onNavigate={onNavigate}
        onVolverDashboard={onVolverDashboard}
        onVolverInicio={onVolverInicio}
        apiOnline={apiOnline}
        title={title ?? meta.title}
        subtitle={subtitle ?? meta.subtitle}
        asideKicker="SGG · Config"
        asideTitle="Configuración"
        asideLogo={<MenuAppIcon id="configuracion" />}
        navAriaLabel="Módulos de configuración"
      >
        {isDashboard ? (
          <div className="sg-hub-panels">
            <SgHubModuleGrid
              items={items}
              onSelect={onNavigate}
              title={
                activeId === "sag_hub"
                  ? "Administración SAG"
                  : activeId === "cuenta_hub"
                    ? "Catálogos de cuenta"
                    : "Módulos"
              }
              kicker="Configuración"
            />
          </div>
        ) : (
          <div className="sg-hub-embedded">{children}</div>
        )}
      </SgHubShell>
    </div>
  );
}
