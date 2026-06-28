import { useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import Proveedores from "./Proveedores";
import ClasificacionProveedores from "./proveedores/ClasificacionProveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";
import StockGanaderoAdmin from "./stock/StockGanaderoAdmin";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";

type ModuloConfig =
  | "menu"
  | "responsables"
  | "proveedores"
  | "clasificacion_proveedores"
  | "rubros"
  | "stock_ganadero";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
}

const MODULOS: {
  id: "responsables" | "proveedores" | "clasificacion_proveedores" | "rubros" | "stock_ganadero";
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
    id: "clasificacion_proveedores",
    label: "Clasificación proveedores",
    subtitle: "Costos de producción, gastos admin. y comerciales",
    icon: "config_clasificacion_proveedores",
  },
  {
    id: "rubros",
    label: "Rubros",
    subtitle: "Rubros y sub-rubros del catálogo",
    icon: "config_rubros",
  },
  {
    id: "stock_ganadero",
    label: "Administración de Stock Ganadero",
    subtitle: "Vaciar y administrar la base de dispositivos",
    icon: "stock_dispositivos",
  },
];

export default function Configuracion({
  apiOnline,
  currentUser,
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

  if (modulo === "clasificacion_proveedores") {
    return (
      <ClasificacionProveedores
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

  if (modulo === "stock_ganadero") {
    return (
      <StockGanaderoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => setModulo("menu")}
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
        <nav className="app-grid" aria-label="Configuración">
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
