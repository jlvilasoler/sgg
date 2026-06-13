import { useState } from "react";
import type { IngresoVenta } from "../../types";
import FormVenta from "./FormVenta";
import VentaListado from "./VentaListado";
import VentaRubros from "./VentaRubros";

type VistaVentas = "menu" | "ingresar" | "listado" | "rubros";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const SUBMENU = [
  {
    id: "ingresar" as const,
    label: "Documentos a ingresar por ventas",
    subtitle: "Registrar factura o ingreso por venta",
    icon: "📄",
    color: "#1a6b4a",
  },
  {
    id: "listado" as const,
    label: "Listado de documentos",
    subtitle: "Ver, editar y eliminar ingresos",
    icon: "📋",
    color: "#1d4e89",
  },
  {
    id: "rubros" as const,
    label: "Rubros ingresos por ventas",
    subtitle: "Rubros, sub-rubros e ítems del catálogo",
    icon: "🏷️",
    color: "#b85c00",
  },
];

export default function IngresosVentas({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<VistaVentas>("menu");
  const [editRow, setEditRow] = useState<IngresoVenta | null>(null);
  const [listRefresh, setListRefresh] = useState(0);

  const volverMenu = () => {
    setVista("menu");
    setEditRow(null);
  };

  if (vista === "ingresar") {
    return (
      <FormVenta
        key={editRow?.id ?? "nuevo"}
        editRow={editRow}
        apiOnline={apiOnline}
        onSaved={() => {
          setListRefresh((k) => k + 1);
          setEditRow(null);
          setVista("listado");
        }}
        onCancelEdit={() => {
          setEditRow(null);
          if (editRow) setVista("listado");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "rubros") {
    return (
      <VentaRubros
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "listado") {
    return (
      <VentaListado
        key={listRefresh}
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onEdit={(row) => {
          setEditRow(row);
          setVista("ingresar");
        }}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
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
          <h2>Ingresos por ventas</h2>
          <p className="muted">
            Registro de documentos e ingresos por ventas de la operación ganadera.
          </p>
        </div>
        <nav className="app-grid app-grid-3" aria-label="Ingresos por ventas">
          {SUBMENU.map((item) => (
            <button
              key={item.id}
              type="button"
              className="app-card-btn"
              onClick={() => setVista(item.id)}
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
