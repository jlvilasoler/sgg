import { useState } from "react";
import { Eye, LayoutList } from "lucide-react";
import SubRubroListado from "./SubRubroListado";
import RubrosSagMonitor from "./RubrosSagMonitor";
import {
  SAG_GASTOS_RUBROS_API,
  SAG_GASTOS_RUBROS_COPY,
} from "./rubrosListadoConfig";
import type { AuthUser } from "../../types";
import {
  canDeleteRubrosCatalogo,
  canDeleteSubRubroItems,
} from "../../utils/auth-permissions";

type RubrosSagTab = "catalogo" | "monitor";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  volverLabel?: string;
}

export default function RubrosSag({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
  volverLabel,
}: Props) {
  const [tab, setTab] = useState<RubrosSagTab>("catalogo");

  return (
    <div className="rubros-sag-shell rubros-sag--hub">
      <header className="rubros-sag-head">
        <div className="rubros-sag-head-copy">
          <p className="sg-hub-panel-kicker">Configuración SAG · Gastos</p>
          <h2 className="sg-hub-panel-title">Rubros y sub-rubros SAG</h2>
          <p className="rubros-sag-lead muted">
            Catálogo base de la plataforma y monitor de visibilidad por cuenta y usuario.
          </p>
        </div>
      </header>

      <nav className="rubros-sag-tabs" aria-label="Secciones de rubros SAG">
        <button
          type="button"
          className={tab === "catalogo" ? "is-active" : ""}
          onClick={() => setTab("catalogo")}
        >
          <LayoutList size={16} aria-hidden />
          Catálogo SAG
        </button>
        <button
          type="button"
          className={tab === "monitor" ? "is-active" : ""}
          onClick={() => setTab("monitor")}
        >
          <Eye size={16} aria-hidden />
          Monitor de cuentas
        </button>
      </nav>

      {tab === "catalogo" ? (
        <SubRubroListado
          apiOnline={apiOnline}
          rubrosApi={SAG_GASTOS_RUBROS_API}
          copy={SAG_GASTOS_RUBROS_COPY}
          onError={onError}
          onSuccess={onSuccess}
          onCatalogosChanged={onCatalogosChanged}
          onVolver={onVolver}
          volverLabel={volverLabel}
          puedeEditar
          puedeEliminar={canDeleteRubrosCatalogo(currentUser ?? null)}
          puedeEliminarItems={canDeleteSubRubroItems(currentUser ?? null)}
          mostrarAmbitoCuenta
          embedded
          hubLayout
        />
      ) : (
        <RubrosSagMonitor apiOnline={apiOnline} onError={onError} />
      )}
    </div>
  );
}
