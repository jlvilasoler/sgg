import { useCallback, useMemo, useState } from "react";
import type { TabId } from "../Header";
import type { AuthUser } from "../../types";
import SgHubShell from "../hub/SgHubShell";
import type { SgHubItem } from "../hub/SgHubTypes";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import AyudaArticuloView from "./AyudaArticuloView";
import AyudaDashboard from "./AyudaDashboard";
import { AYUDA_ARTICULOS, findAyudaArticulo, type AyudaArticulo } from "../../help/ayuda-manual";

interface Props {
  currentUser: AuthUser;
  apiOnline: boolean;
  onVolver: () => void;
  onOpenModulo?: (id: TabId) => void;
}

function articuloToHubItem(a: AyudaArticulo): SgHubItem {
  return {
    id: a.id,
    label: a.label,
    subtitle: a.subtitle,
    icon: a.icon,
    featured: a.destacado,
  };
}

export default function AyudaManual({
  currentUser,
  apiOnline,
  onVolver,
  onOpenModulo,
}: Props) {
  const [activeId, setActiveId] = useState("menu");

  const hubItems = useMemo(() => AYUDA_ARTICULOS.map(articuloToHubItem), []);

  const articuloActivo = activeId === "menu" ? null : findAyudaArticulo(activeId);
  const enDashboard = activeId === "menu";

  const meta = useMemo(() => {
    if (articuloActivo) {
      return {
        title: "Manual SAG",
        subtitle: "Guía visual del módulo seleccionado",
      };
    }
    return {
      title: "Centro de ayuda",
      subtitle: "Explorá las guías o buscá un tema en el manual",
    };
  }, [articuloActivo]);

  const volverDashboard = useCallback(() => {
    setActiveId("menu");
  }, []);

  return (
    <div
      className={`sg-module-page ayuda-module-page${enDashboard ? " ayuda-module-page--dashboard" : " ayuda-module-page--articulo"}`}
    >
      <SgHubShell
        activeId={activeId}
        items={hubItems}
        onNavigate={setActiveId}
        onVolverDashboard={volverDashboard}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={meta.title}
        subtitle={meta.subtitle}
        asideKicker="SAG"
        asideTitle="Ayuda"
        asideLogo={<MenuAppIcon id="ayuda" />}
        navAriaLabel="Temas del manual de ayuda"
        hubClassName="ayuda-hub"
      >
        {enDashboard ? (
          <AyudaDashboard onSelect={setActiveId} />
        ) : articuloActivo ? (
          <AyudaArticuloView
            articulo={articuloActivo}
            currentUser={currentUser}
            onOpenModulo={onOpenModulo}
          />
        ) : (
          <p className="muted">Tema no encontrado.</p>
        )}
      </SgHubShell>
    </div>
  );
}
