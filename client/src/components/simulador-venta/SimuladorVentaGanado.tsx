import { useEffect, useState } from "react";
import { HubMenuCard } from "../HubMenuCard";
import { useHeaderBackContext } from "../../header-back";
import { MENU_APP_THEMES, MenuAppIcon } from "../icons/MenuAppIcons";
import SimuladorVentaPanel from "./SimuladorVentaPanel";
import {
  SIMULADOR_VENTA_TIPOS,
  SIMULADOR_VENTA_TIPO_MAP,
  type SimuladorVentaTipoConfig,
} from "./simulador-venta-config";
import type { SimuladorVentaTipo } from "../../types";
import type { AuthUser } from "../../types";

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const BALANZA_THEME = {
  accent: "#b45309",
  accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 45%, #fbbf24 100%)",
  accentGlow: "rgba(180, 83, 9, 0.28)",
} as const;

export default function SimuladorVentaGanado({
  user,
  apiOnline,
  onError,
  onSuccess,
}: Props) {
  const [tipo, setTipo] = useState<SimuladorVentaTipo | null>(null);
  const headerBack = useHeaderBackContext();

  useEffect(() => {
    if (!headerBack) return;
    if (tipo) {
      const cfg = SIMULADOR_VENTA_TIPO_MAP[tipo];
      headerBack.setStep({
        onBack: () => setTipo(null),
        destinationLabel: cfg.titulo,
      });
    } else {
      headerBack.setStep(null);
    }
    return () => headerBack.setStep(null);
  }, [tipo, headerBack]);

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

  return (
    <div className="proveedores-hub simulador-venta-hub">
      <p className="simulador-venta-intro muted">
        Calculá el ingreso estimado de una venta usando los últimos precios ACG registrados.
        Guardá cada simulación para consultarla después.
      </p>
      <nav className="app-grid app-grid-2" aria-label="Tipos de simulación de venta">
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
