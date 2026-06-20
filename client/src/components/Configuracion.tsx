import { useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackStep } from "../header-back";
import Proveedores from "./Proveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";

type ModuloConfig = "menu" | "responsables" | "proveedores" | "rubros";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
}

const MODULOS: {
  id: "responsables" | "proveedores" | "rubros";
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "responsables",
    label: "Presupuesto asignado",
    subtitle: "Personas a quien se asigna el gasto",
    icon: "config_responsables",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    subtitle: "Catálogo de proveedores",
    icon: "config_proveedores",
  },
  {
    id: "rubros",
    label: "Rubros",
    subtitle: "Rubros y sub-rubros del catálogo",
    icon: "config_rubros",
  },
];

export default function Configuracion({
  apiOnline,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
}: Props) {
  const [modulo, setModulo] = useState<ModuloConfig>("menu");
  useHeaderBackStep(modulo !== "menu", () => setModulo("menu"), "Configuración");

  if (modulo === "responsables") {
    return (
      <Responsables
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => setModulo("menu")}
      />
    );
  }

  if (modulo === "proveedores") {
    return (
      <Proveedores
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => setModulo("menu")}
      />
    );
  }

  if (modulo === "rubros") {
    return (
      <Rubros
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => setModulo("menu")}
        volverLabel="a Configuración"
      />
    );
  }

  return (
    <div className="subseccion-panel configuracion-hub">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al inicio
      </button>
      <div className="card configuracion-hub-card">
        <div className="form-header">
          <h2>Configuración</h2>
          <p className="muted">
            Catálogos de apoyo para registrar gastos:{" "}
            <strong>presupuesto asignado</strong>, <strong>proveedores</strong> y{" "}
            <strong>rubros</strong>.
          </p>
        </div>
        <nav className="app-grid app-grid-3" aria-label="Configuración">
          {MODULOS.map((item) => (
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={HUB_ICON_THEMES[item.icon]}
              icon={<HubMenuIcon id={item.icon} />}
              onClick={() => setModulo(item.id)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
