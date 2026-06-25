import { useState } from "react";
import { HubMenuCard } from "../HubMenuCard";
import { useHeaderBackStep } from "../../header-back";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import TiposDocumentoGasto from "./TiposDocumentoGasto";

type Vista = "menu" | "tipos_gasto";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const SUBMENU: { id: Vista; label: string; subtitle: string; icon: HubIconId }[] = [
  {
    id: "tipos_gasto",
    label: "Tipos para Ingresar gasto",
    subtitle: "Campos por documento (BROU, facturas, etc.)",
    icon: "config_rubros",
  },
];

export default function DocumentosDigitalesHub({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<Vista>("menu");

  useHeaderBackStep(vista !== "menu", () => setVista("menu"), "Documentos Digitales");

  if (vista === "tipos_gasto") {
    return (
      <TiposDocumentoGasto
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => setVista("menu")}
      />
    );
  }

  return (
    <div className="layout-frame home-menu-inner">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al menú
      </button>
      <div className="form-header subseccion-inline-head">
        <div>
          <h2>Documentos Digitales</h2>
          <p className="muted">
            Centro de configuración vinculado con Ingresar gasto y otros módulos.
          </p>
        </div>
      </div>
      <nav className="app-grid" aria-label="Documentos digitales">
        {SUBMENU.map((item) => (
          <HubMenuCard
            key={item.id}
            label={item.label}
            subtitle={item.subtitle}
            theme={HUB_ICON_THEMES[item.icon]}
            icon={<HubMenuIcon id={item.icon} className="menu-app-icon-svg" />}
            onClick={() => setVista(item.id)}
          />
        ))}
      </nav>
    </div>
  );
}
