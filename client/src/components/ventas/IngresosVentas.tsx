import { useCallback, useEffect, useState } from "react";
import { HubMenuCard } from "../HubMenuCard";
import { useHeaderBackContext } from "../../header-back";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import VentaRubros from "./VentaRubros";
import VentasGanadoCerradas from "./VentasGanadoCerradas";
import VentasAgricultura from "./VentasAgricultura";
import VentasIngresosSeccion from "./VentasIngresosSeccion";

type VistaVentas =
  | "menu"
  | "rubros"
  | "ventas_ganado"
  | "ventas_agricultura"
  | "ventas_arrendamientos";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const SUBMENU: {
  id: Exclude<VistaVentas, "menu">;
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "ventas_ganado",
    label: "Ventas de ganado cerradas",
    subtitle: "Ventas cerradas del simulador con totales",
    icon: "ventas_ganado",
  },
  {
    id: "ventas_agricultura",
    label: "Ventas Agricultura",
    subtitle: "Ventas cerradas desde el simulador agrícola",
    icon: "ventas_agricultura",
  },
  {
    id: "ventas_arrendamientos",
    label: "Ingresos por Arrendamientos",
    subtitle: "Arrendamientos, medianería y uso de campos",
    icon: "ventas_arrendamientos",
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

  const volverMenu = useCallback(() => {
    setVista("menu");
  }, []);

  const headerBack = useHeaderBackContext();
  useEffect(() => {
    if (!headerBack) return;
    if (vista === "menu") {
      headerBack.setStep(null);
      return;
    }
    headerBack.setStep({
      onBack: volverMenu,
      destinationLabel: "Ingresos por ventas",
    });
    return () => headerBack.setStep(null);
  }, [vista, volverMenu, headerBack]);

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

  if (vista === "ventas_agricultura") {
    return (
      <VentasAgricultura
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "ventas_arrendamientos") {
    return (
      <VentasIngresosSeccion
        titulo="Ingresos por arrendamientos y medianería"
        descripcion="Registro de ingresos por arrendamiento de campos, medianería y acuerdos de uso."
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
            Ganado, agricultura, arrendamientos y catálogo de rubros de ingresos.
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
