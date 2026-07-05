import { useCallback, useState } from "react";
import { useHeaderBackStep } from "../header-back";
import { DIVISAS_MONEDAS, type DivisasMonedaId } from "./divisas/divisas-config";
import DivisasHistorial from "./divisas/DivisasHistorial";
import DivisasHub from "./divisas/DivisasHub";
import DivisasHubDashboard from "./divisas/DivisasHubDashboard";
import { divisasHubMeta } from "./divisas/divisas-hub-items";

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
        <DivisasHubDashboard
          apiOnline={apiOnline}
          onNavigate={(id) => setVista(id)}
        />
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
