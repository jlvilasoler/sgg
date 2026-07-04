import { useCallback, useEffect, useState } from "react";
import { useHeaderBackContext } from "../../header-back";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import { MENU_APP_THEMES, MenuAppIcon } from "../icons/MenuAppIcons";
import { PageModuleHeadRow } from "../PageModuleHead";
import { HubMenuCard } from "../HubMenuCard";
import SimuladorVentaPanel from "./SimuladorVentaPanel";
import VentasAgricultura from "../ventas/VentasAgricultura";
import VentasArrendamientos from "../ventas/VentasArrendamientos";
import {
  SIMULADOR_VENTA_TIPOS,
  SIMULADOR_VENTA_TIPO_MAP,
  type SimuladorVentaTipoConfig,
} from "./simulador-venta-config";
import type { AuthUser, Catalogos, SimuladorVentaTipo } from "../../types";

export type SimuladorSeccionId = "en_pie" | "cuarta_balanza" | "agricultura" | "arrendamientos";

interface Props {
  user: AuthUser;
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  embedded?: boolean;
  seccion?: SimuladorSeccionId;
  onVolverDashboard?: () => void;
}

type VistaSimulador =
  | "menu"
  | "ventas_ganado"
  | "ventas_agricultura"
  | "ventas_arrendamientos";

const SIMULADOR_MENU = [
  {
    id: "ventas_ganado" as const,
    label: "Ventas de Ganado",
    subtitle: "En pie y cuarta balanza · precios ACG",
    icon: "ventas_ganado" as const,
  },
  {
    id: "ventas_agricultura" as const,
    label: "Ventas Agrícolas",
    subtitle: "Cultivos, has y rendimiento estimado",
    icon: "ventas_agricultura" as const,
  },
  {
    id: "ventas_arrendamientos" as const,
    label: "Ingresos por Arrendamientos",
    subtitle: "Arrendamientos, medianería y uso de campos",
    icon: "ventas_arrendamientos" as const,
  },
] as const;

const BALANZA_THEME = {
  accent: "#b45309",
  accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 45%, #fbbf24 100%)",
  accentGlow: "rgba(180, 83, 9, 0.28)",
} as const;

const VISTA_LABELS: Record<Exclude<VistaSimulador, "menu">, string> = {
  ventas_ganado: "Ventas de Ganado",
  ventas_agricultura: "Ventas Agrícolas",
  ventas_arrendamientos: "Ingresos por Arrendamientos",
};

const SECCION_TIPO: Record<"en_pie" | "cuarta_balanza", SimuladorVentaTipo> = {
  en_pie: "EN_PIE",
  cuarta_balanza: "CUARTA_BALANZA",
};

export default function SimuladorVentas({
  user,
  catalogos,
  apiOnline,
  onError,
  onSuccess,
  embedded = false,
  seccion,
  onVolverDashboard,
}: Props) {
  const [vista, setVista] = useState<VistaSimulador>("menu");
  const [tipo, setTipo] = useState<SimuladorVentaTipo | null>(null);
  const headerBack = useHeaderBackContext();

  const volverMenu = useCallback(() => setVista("menu"), []);

  useEffect(() => {
    if (embedded) return;
    if (!headerBack) return;
    if (tipo) {
      const cfg = SIMULADOR_VENTA_TIPO_MAP[tipo];
      headerBack.setStep({
        onBack: () => setTipo(null),
        destinationLabel: cfg.titulo,
      });
    } else if (vista !== "menu") {
      headerBack.setStep({
        onBack: volverMenu,
        destinationLabel: VISTA_LABELS[vista],
      });
    } else {
      headerBack.setStep(null);
    }
    return () => headerBack.setStep(null);
  }, [vista, tipo, headerBack, embedded, volverMenu]);

  if (embedded && seccion) {
    if (seccion === "en_pie" || seccion === "cuarta_balanza") {
      const config = SIMULADOR_VENTA_TIPO_MAP[SECCION_TIPO[seccion]] as SimuladorVentaTipoConfig;
      return (
        <SimuladorVentaPanel
          config={config}
          user={user}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
        />
      );
    }
    if (seccion === "agricultura") {
      return (
        <VentasAgricultura
          embedded
          catalogos={catalogos}
          modo="simulador"
          user={user}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          onVolver={onVolverDashboard ?? volverMenu}
        />
      );
    }
    return (
      <VentasArrendamientos
        embedded
        catalogos={catalogos}
        modo="simulador"
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={onVolverDashboard ?? volverMenu}
      />
    );
  }

  if (tipo) {
    const config = SIMULADOR_VENTA_TIPO_MAP[tipo] as SimuladorVentaTipoConfig;
    return (
      <SimuladorVentaPanel
        config={config}
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (vista === "ventas_ganado") {
    return (
      <div className="proveedores-hub simulador-venta-hub">
        <header className="module-hub-head">
          <PageModuleHeadRow
            icon={{ source: "app", id: "simulador_venta_ganado" }}
            title="Simulador de Ventas"
            subtitle="Calculá el ingreso estimado usando los últimos precios ACG registrados"
          />
        </header>
        <nav className="app-grid app-grid-2" aria-label="Tipos de simulación de venta de ganado">
          {SIMULADOR_VENTA_TIPOS.map((t) => (
            <HubMenuCard
              key={t.id}
              label={t.titulo}
              subtitle={t.subtitulo}
              theme={
                t.icon === "pie" ? MENU_APP_THEMES.simulador_venta_ganado : BALANZA_THEME
              }
              icon={<MenuAppIcon id="simulador_venta_ganado" />}
              onClick={() => setTipo(t.id)}
            />
          ))}
        </nav>
      </div>
    );
  }

  if (vista === "ventas_agricultura") {
    return (
      <VentasAgricultura
        catalogos={catalogos}
        modo="simulador"
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "ventas_arrendamientos") {
    return (
      <VentasArrendamientos
        catalogos={catalogos}
        modo="simulador"
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  return (
    <div className="proveedores-hub simulador-venta-hub">
      <header className="module-hub-head">
        <PageModuleHeadRow
          icon={{ source: "app", id: "simulador_venta_ganado" }}
          title="Simulador de Ventas"
          subtitle="Simulá ingresos por ventas antes de concretar la operación"
        />
      </header>
      <nav className="app-grid app-grid-2" aria-label="Secciones del simulador de ventas">
        {SIMULADOR_MENU.map((item) => (
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
  );
}
