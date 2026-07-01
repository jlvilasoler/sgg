import { useEffect, useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackContext } from "../header-back";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import { PageModuleHeadRow } from "./PageModuleHead";
import DivisasMonedaHub from "./divisas/DivisasMonedaHub";
import {
  DIVISAS_MONEDA_LIST,
  DIVISAS_MONEDAS,
  type DivisasMonedaId,
} from "./divisas/divisas-config";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function Divisas({ apiOnline, onError, onSuccess }: Props) {
  const [moneda, setMoneda] = useState<DivisasMonedaId | null>(null);
  const headerBack = useHeaderBackContext();

  useEffect(() => {
    if (!headerBack) return;
    if (moneda) {
      headerBack.setStep({
        onBack: () => setMoneda(null),
        destinationLabel: "Divisas",
      });
    } else {
      headerBack.setStep(null);
    }
    return () => headerBack.setStep(null);
  }, [moneda, headerBack]);

  if (moneda) {
    return (
      <DivisasMonedaHub
        config={DIVISAS_MONEDAS[moneda]}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolverDivisas={() => setMoneda(null)}
      />
    );
  }

  return (
    <div className="proveedores-hub">
      <header className="module-hub-head">
        <PageModuleHeadRow
          icon={{ source: "app", id: "divisas" }}
          title="Divisas"
          subtitle="Tipos de cambio USD, pesos uruguayos y reales brasileños"
        />
      </header>
      <nav className="app-grid app-grid-2" aria-label="Monedas en divisas">
        {DIVISAS_MONEDA_LIST.map((m) => (
          <HubMenuCard
            key={m.id}
            label={m.titulo}
            subtitle={m.subtitulo}
            theme={HUB_ICON_THEMES[m.icon]}
            icon={<HubMenuIcon id={m.icon} />}
            onClick={() => setMoneda(m.id)}
          />
        ))}
      </nav>
    </div>
  );
}
