import { useCallback, useState } from "react";
import { useHeaderBackStep } from "../header-back";
import SgHubModuleGrid from "./hub/SgHubModuleGrid";
import { DIVISAS_MONEDAS, type DivisasMonedaId } from "./divisas/divisas-config";
import DivisasHistorial from "./divisas/DivisasHistorial";
import DivisasHub from "./divisas/DivisasHub";
import { DIVISAS_HUB_ITEMS, divisasHubMeta } from "./divisas/divisas-hub-items";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function Divisas({ apiOnline, onError, onSuccess, onVolver }: Props) {
  const [vista, setVista] = useState<DivisasMonedaId | "menu">("menu");

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Divisas");

  const meta =
    vista === "menu"
      ? {
          title: "Dashboard",
          subtitle: "Tipos de cambio USD, pesos uruguayos y reales brasileños.",
        }
      : divisasHubMeta(vista) ?? { title: "Divisas", subtitle: "" };

  return (
    <DivisasHub
      vista={vista}
      onNavigate={(id) => setVista(id as DivisasMonedaId)}
      onVolverDashboard={volverMenu}
      onVolver={onVolver}
      apiOnline={apiOnline}
      title={meta.title}
      subtitle={meta.subtitle}
      embedded={vista !== "menu"}
    >
      {vista === "menu" ? (
        <div className="sg-hub-panels">
          <SgHubModuleGrid
            items={DIVISAS_HUB_ITEMS}
            onSelect={(id) => setVista(id as DivisasMonedaId)}
            title="Monedas"
            kicker="Tipos de cambio"
          />
        </div>
      ) : (
        <DivisasHistorial
          key={vista}
          embedded
          config={DIVISAS_MONEDAS[vista]}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          onVolver={volverMenu}
        />
      )}
    </DivisasHub>
  );
}
