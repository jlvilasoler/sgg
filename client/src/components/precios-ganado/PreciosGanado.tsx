import { useCallback, useState } from "react";
import { useHeaderBackStep } from "../../header-back";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import type { SegmentoPreciosGanado } from "../../types";
import PreciosGanadoPanel from "./PreciosGanadoPanel";
import {
  PRECIOS_GANADO_HUB_ITEMS,
  preciosGanadoHubMeta,
} from "./precios-ganado-hub-items";
import { PRECIOS_GANADO_SEGMENTOS } from "./precios-ganado-config";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function PreciosGanado({ apiOnline, onError, onSuccess, onVolver }: Props) {
  const [vista, setVista] = useState<SegmentoPreciosGanado | "menu">("menu");

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Precios de Ganado");

  const config =
    vista !== "menu"
      ? PRECIOS_GANADO_SEGMENTOS.find((s) => s.id === vista)
      : undefined;

  const meta =
    vista === "menu"
      ? {
          title: "Dashboard",
          subtitle: "Cotizaciones de gordo y reposición en USD por kilogramo.",
        }
      : preciosGanadoHubMeta(vista) ?? { title: "Precios de Ganado", subtitle: "" };

  return (
    <div className="sg-module-page precios-ganado-module-page">
      <SgHubShell
        activeId={vista}
        items={PRECIOS_GANADO_HUB_ITEMS}
        onNavigate={(id) => setVista(id as SegmentoPreciosGanado)}
        onVolverDashboard={volverMenu}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={meta.title}
        subtitle={meta.subtitle}
        asideKicker="SGG · Mercado"
        asideTitle="Precios de Ganado"
        asideLogo={<MenuAppIcon id="precios_ganado" />}
        navAriaLabel="Segmentos de precios de ganado"
      >
        {vista === "menu" ? (
          <div className="sg-hub-panels">
            <SgHubModuleGrid
              items={PRECIOS_GANADO_HUB_ITEMS}
              onSelect={(id) => setVista(id as SegmentoPreciosGanado)}
              title="Segmentos"
              kicker="Cotizaciones ACG"
            />
          </div>
        ) : config ? (
          <PreciosGanadoPanel
            embedded
            config={config}
            apiOnline={apiOnline}
            onError={onError}
            onSuccess={onSuccess}
          />
        ) : null}
      </SgHubShell>
    </div>
  );
}
