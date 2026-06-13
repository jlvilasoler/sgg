import { useState } from "react";
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
      <p className="muted divisas-hub-intro">
        
      </p>
      <nav className="app-grid app-grid-2" aria-label="Monedas en divisas">
        {DIVISAS_MONEDA_LIST.map((m) => (
          <button
            key={m.id}
            type="button"
            className="app-card-btn"
            onClick={() => setMoneda(m.id)}
          >
            <span
              className="app-card-icon"
              style={{
                background: `linear-gradient(145deg, ${m.color}, ${m.color}bb)`,
              }}
            >
              <span className="app-icon-emoji divisas-moneda-icon" aria-hidden>
                {m.icon}
              </span>
            </span>
            <span className="app-card-text">
              <span className="app-card-label">{m.titulo}</span>
              <span className="app-card-sub">{m.subtitulo}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
