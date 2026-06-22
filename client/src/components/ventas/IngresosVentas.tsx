import { useCallback, useEffect, useState } from "react";
import type { IngresoVenta } from "../../types";
import { HubMenuCard } from "../HubMenuCard";
import { useHeaderBackContext } from "../../header-back";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import FormVenta from "./FormVenta";
import VentaListado from "./VentaListado";
import VentaRubros from "./VentaRubros";
import VentasGanadoCerradas from "./VentasGanadoCerradas";

type VistaVentas = "menu" | "ingresar" | "listado" | "rubros" | "ventas_ganado";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const SUBMENU: {
  id: "ingresar" | "listado" | "rubros" | "ventas_ganado";
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "ingresar",
    label: "Documentos a ingresar por ventas",
    subtitle: "Registrar factura o ingreso por venta",
    icon: "ventas_ingresar",
  },
  {
    id: "listado",
    label: "Listado de documentos",
    subtitle: "Ver, editar y eliminar ingresos",
    icon: "ventas_listado",
  },
  {
    id: "ventas_ganado",
    label: "Ventas de ganado cerradas",
    subtitle: "Ventas cerradas del simulador con totales",
    icon: "ventas_ganado",
  },
  {
    id: "rubros",
    label: "Rubros ingresos por ventas",
    subtitle: "Rubros, sub-rubros e ítems del catálogo",
    icon: "ventas_rubros",
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

  const volverMenu = useCallback(() => {
    setVista("menu");
    setEditRow(null);
  }, []);

  const headerBack = useHeaderBackContext();
  useEffect(() => {
    if (!headerBack) return;
    if (vista === "menu") {
      headerBack.setStep(null);
      return;
    }
    if (vista === "ingresar" && editRow) {
      headerBack.setStep({
        onBack: () => {
          setEditRow(null);
          setVista("listado");
        },
        destinationLabel: "Listado de documentos",
      });
      return () => headerBack.setStep(null);
    }
    headerBack.setStep({
      onBack: volverMenu,
      destinationLabel: "Ingresos por ventas",
    });
    return () => headerBack.setStep(null);
  }, [vista, editRow, volverMenu, headerBack]);

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

  if (vista === "ventas_ganado") {
    return (
      <VentasGanadoCerradas
        apiOnline={apiOnline}
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
        <nav className="app-grid" aria-label="Ingresos por ventas">
          {SUBMENU.map((item) => (
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={HUB_ICON_THEMES[item.icon]}
              icon={<HubMenuIcon id={item.icon} />}
              onClick={() => setVista(item.id)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
