import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import type { AuthUser } from "../../types";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import {
  buildConfigCuentaAdminGridItems,
  buildConfigNavLayout,
  configHubMeta,
  flattenConfigNavLayout,
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
  onOpenMiPerfil?: () => void;
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
  onOpenMiPerfil,
  title,
  subtitle,
  children,
}: Props) {
  /** Dentro del hub de cuenta: mostrar los módulos del grupo en el lateral. */
  const expandAdmin =
    activeId === "cuenta_hub" ||
    (navScope === "cuenta" && activeId !== "menu");

  const navLayout = useMemo(
    () =>
      buildConfigNavLayout(navScope, currentUser, esSuperAdmin, {
        expandAdmin,
      }),
    [navScope, currentUser, esSuperAdmin, expandAdmin]
  );
  const itemsFlat = useMemo(() => flattenConfigNavLayout(navLayout), [navLayout]);
  const cuentaAdminGridItems = useMemo(
    () => buildConfigCuentaAdminGridItems(currentUser),
    [currentUser]
  );
  const meta = configHubMeta(activeId, cuentaNombre);
  const isDashboard =
    activeId === "menu" || activeId === "cuenta_hub" || activeId === "sag_hub";

  const handleNavigate = useCallback(
    (id: string) => {
      if (id === "mi_perfil") {
        onOpenMiPerfil?.();
        return;
      }
      onNavigate(id);
    },
    [onNavigate, onOpenMiPerfil]
  );

  const dashboardGridItems =
    activeId === "cuenta_hub" ? cuentaAdminGridItems : itemsFlat;

  const dashboardTitle =
    activeId === "sag_hub"
      ? "Administración SAG"
      : activeId === "cuenta_hub"
        ? "Administración de Cuenta"
        : "Módulos";

  return (
    <div className="sg-module-page config-module-page">
      <SgHubShell
        activeId={activeId}
        items={navLayout.items}
        navSections={navLayout.sections}
        onNavigate={handleNavigate}
        onVolverDashboard={onVolverDashboard}
        onVolverInicio={onVolverInicio}
        apiOnline={apiOnline}
        title={title ?? meta.title}
        subtitle={subtitle ?? meta.subtitle}
        asideKicker="SAG"
        asideTitle="Configuración"
        asideLogo={<MenuAppIcon id="configuracion" />}
        navAriaLabel="Módulos de configuración"
      >
        {isDashboard ? (
          <div className="sg-hub-panels">
            <SgHubModuleGrid
              items={dashboardGridItems}
              onSelect={handleNavigate}
              title={dashboardTitle}
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
