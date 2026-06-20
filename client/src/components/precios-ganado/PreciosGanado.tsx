import { useEffect, useState } from "react";
import { HubMenuCard } from "../HubMenuCard";
import { useHeaderBackContext } from "../../header-back";
import { MENU_APP_THEMES, MenuAppIcon } from "../icons/MenuAppIcons";
import PreciosGanadoPanel from "./PreciosGanadoPanel";
import {
  PRECIOS_GANADO_SEGMENTOS,
  type PreciosGanadoSegmentoConfig,
} from "./precios-ganado-config";
import type { SegmentoPreciosGanado } from "../../types";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const REPOSICION_THEME = {
  accent: "#15803d",
  accentSoft: "linear-gradient(145deg, #f0fdf4 0%, #bbf7d0 45%, #86efac 100%)",
  accentGlow: "rgba(21, 128, 61, 0.28)",
} as const;

export default function PreciosGanado({ apiOnline, onError, onSuccess }: Props) {
  const [segmento, setSegmento] = useState<SegmentoPreciosGanado | null>(null);
  const headerBack = useHeaderBackContext();

  useEffect(() => {
    if (!headerBack) return;
    if (segmento) {
      const cfg = PRECIOS_GANADO_SEGMENTOS.find((s) => s.id === segmento);
      headerBack.setStep({
        onBack: () => setSegmento(null),
        destinationLabel: cfg?.titulo ?? "Precios de Ganado",
      });
    } else {
      headerBack.setStep(null);
    }
    return () => headerBack.setStep(null);
  }, [segmento, headerBack]);

  if (segmento) {
    const config = PRECIOS_GANADO_SEGMENTOS.find(
      (s) => s.id === segmento
    ) as PreciosGanadoSegmentoConfig;
    return (
      <PreciosGanadoPanel
        config={config}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="proveedores-hub">
      <nav className="app-grid app-grid-2" aria-label="Tipos de precios de ganado">
        {PRECIOS_GANADO_SEGMENTOS.map((s) => (
          <HubMenuCard
            key={s.id}
            label={s.titulo}
            subtitle={s.subtitulo}
            theme={s.icon === "gordo" ? MENU_APP_THEMES.precios_ganado : REPOSICION_THEME}
            icon={<MenuAppIcon id="precios_ganado" />}
            onClick={() => setSegmento(s.id)}
          />
        ))}
      </nav>
    </div>
  );
}
