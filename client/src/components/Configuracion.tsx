import { useState } from "react";
import Proveedores from "./Proveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";

type ModuloConfig = "menu" | "responsables" | "proveedores" | "rubros";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
}

const MODULOS = [
  {
    id: "responsables" as const,
    label: "Presupuesto asignado",
    subtitle: "Personas a quien se asigna el gasto",
    icon: "👤",
    color: "#4a6fa5",
  },
  {
    id: "proveedores" as const,
    label: "Proveedores",
    subtitle: "Catálogo de proveedores",
    icon: "🏢",
    color: "#5c4b8a",
  },
  {
    id: "rubros" as const,
    label: "Rubros",
    subtitle: "Rubros y sub-rubros del catálogo",
    icon: "🏷️",
    color: "#b85c00",
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
            <button
              key={item.id}
              type="button"
              className="app-card-btn"
              onClick={() => setModulo(item.id)}
            >
              <span
                className="app-card-icon"
                style={{
                  background: `linear-gradient(145deg, ${item.color}, ${item.color}bb)`,
                }}
              >
                <span className="app-icon-emoji" aria-hidden>
                  {item.icon}
                </span>
              </span>
              <span className="app-card-text">
                <span className="app-card-label">{item.label}</span>
                <span className="app-card-sub">{item.subtitle}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
